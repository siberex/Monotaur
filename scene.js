import {
    AxesHelper,
    Box2,
    ExtrudeGeometry,
    Group,
    MathUtils,
    Mesh,
    MeshNormalMaterial,
    OrthographicCamera,
    PerspectiveCamera,
    Scene,
    Vector2,
    Vector3,
    WebGLRenderer
} from 'three';
import {SVGLoader} from 'three/examples/jsm/loaders/SVGLoader.js';
import WebGL from 'three/examples/jsm/capabilities/WebGL.js';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CSG} from 'three-csg-ts';
import {Brush, Evaluator, INTERSECTION, SUBTRACTION} from 'three-bvh-csg';
import {randomInt} from "./utils.js";
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

// Animation rotation direction (false = CW, true = CCW)
const ROTATE_CCW = false;

// Rotation around Y-axis, which is directed from bottom to top
const INTERSECTION_ANGLE = MathUtils.degToRad(90) * (ROTATE_CCW ? -1 : 1);
// Rotation speed: turn this amount with each animation  frame
const ROTATION_STEP = MathUtils.degToRad(0.5) * (ROTATE_CCW ? 1 : -1);


let SCREEN_WIDTH = window.innerWidth;
let SCREEN_HEIGHT = window.innerHeight;
let aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
const frustumSize = 2000;

// Init three.js scene
const scene = new Scene();

// https://threejs.org/docs/#api/en/cameras/PerspectiveCamera
const camera = new PerspectiveCamera( 15, aspect, 0.1, 20000 );
camera.position.z = 8000;
camera.position.y = 2000;

// https://threejs.org/docs/#api/en/cameras/OrthographicCamera
const cameraOrtho = new OrthographicCamera(- 0.5 * frustumSize * aspect, 0.5 * frustumSize * aspect, frustumSize / 2, frustumSize / -2, 0.1, 10000);
cameraOrtho.position.z = 5000;
cameraOrtho.position.y = 100;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
document.body.appendChild( renderer.domElement );

// Resize and update camera
window.addEventListener('resize', onWindowResize);


// Load SVG, extrude surface from SVG paths and Binary Intersect resulting Meshes
// https://threejs.org/docs/#examples/en/loaders/SVGLoader
const loader = new SVGLoader();
// const material = new MeshNormalMaterial({ wireframe: false, transparent: true, opacity: 0.7 });
const material = new MeshNormalMaterial({ wireframe: true });


/**
 * @type {string[]}
 */
const svg = [
    'M0 1100V0h660v1100zm220-220V220h220v660z',
    'M220 220v660H0v220h660V880H440V0H0v220z',
    'M220 660h440V0H0v220h440v220H0v660h660V880H220z',
    'M0 1100h660V0H0v220h440v220H220v220h220v220H0z',
    'M440 440H220V0H0v660h440v440h220V0H440z',
    'M220 440h440v660H0V880h440V660H0V0h660v220H220z',
    'M0 1100V0h660v220H220v220h440v660zm220-220V660h220v220z',
    'M660 1100V0H0v220h440v880z',
    'M660 0v1100H0V0zM220 880V660h220v220zm220-660v220H220V220z',
    'M660 0v1100H0V880h440V660H0V0zM440 220v220H220V220z',
].map(path => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 1100" fill-rule="evenodd"><path d="${path}"/></svg>`);


/**
 * Parse all SVG text chunks.
 *
 * @type {SVGResult[]}
 */
const svgData = svg.map(loader.parse);

/**
 * Extrude Mesh for each set of SVG paths.
 * Get only the first mesh from each list of meshes produced by extrusion.
 *
 * @type {Brush[]}
 */
const meshes = svgData.map(svgResult => {
    const meshList = MeshFromPath(svgResult.paths, true, material);
    return meshList[0] ? meshList[0] : null;
}).filter(Boolean);

/**
 * Get right-angle rotations along vertical axis for all meshes.
 * Used for Boolean Intersections later.
 *
 * @type {Brush[]}
 */
const rotations = meshes.map(mesh => {
    let rotated = mesh.clone();
    rotated.rotation.y = INTERSECTION_ANGLE;
    // It is important to apply all transformations:
    rotated.updateMatrix();
    return rotated;
});

/**
 * @type {number[][]}
 */
const vertexCounts = [];

/**
 * Produce Boolean Intersection for all digit pairs:
 *      0: 0-0, 0-1, ... , 0-9,
 *      1: 1-0, 1-1, ... , 1-9, ...
 *
 * @type {Mesh[][]}
 */
let intersections = [];
for (let i = 0; i < meshes.length; i++) {
    let pairs = [];
    for (let j = 0; j < rotations.length; j++) {
        const meshIntersection = bhvCsgIntersect(meshes[i], rotations[j]);

        // Note: Geometry vertices count in the resulting mesh will be much larger
        //       than the sum of source geometries vertices.
        vertexCounts.push([
            i, j,
            meshes[i].geometry.attributes.position.count / 3,
            rotations[j].geometry.attributes.position.count / 3,
            meshIntersection.geometry.attributes.position.count / 3
        ]);
        pairs.push(meshIntersection);
    }
    intersections.push(pairs);
}

// console.log( csv(vertexCounts) );

// Group to put intersected digits to
const group = new Group();

// group.add(meshes[3]);
let rotateFrom = 0;
// let rotateTo = randomInt(10);
let rotateTo = 1;
group.add(intersections[rotateFrom][rotateTo]);
// group.add(rotations[rotateFrom]);

// Group to rotate
const rotationGroup = new Group();
rotationGroup.add(group);
rotationGroup.add(new AxesHelper(1500));

// Add rotation group to the scene
scene.add(rotationGroup);

// group.rotateY( MathUtils.degToRad(45) * (ROTATE_CCW ? 1 : -1) );

const activeQuadrant = ROTATE_CCW ? 3 : 0;
let lastRotationPhase = activeQuadrant;

camera.lookAt(rotationGroup.position);
cameraOrtho.lookAt(rotationGroup.position);

// setInterval(() => console.log('——————————'), 10000);

function animate() {
    requestAnimationFrame( animate );

    rotationGroup.rotateY(ROTATION_STEP);

    let rotationPhase = GetRotationQuadrant(rotationGroup);

    // Switch models every 90° of rotation
    if (rotationPhase !== lastRotationPhase) {
        // console.log(rotationPhase);

        group.remove(intersections[rotateFrom][rotateTo]);
        // group.remove(rotations[rotateFrom]);

        // Reset rotation by reverse-rotating newly-added model back to origin,
        // because rotationGroup were rotated by 90 degrees.
        group.rotateY(INTERSECTION_ANGLE);

        // Rotation to the next random digit
        rotateFrom = rotateTo
        // rotateTo = randomInt(10);
        rotateTo = (rotateTo + 1) % 10;
        group.add(intersections[rotateFrom][rotateTo]);
        // group.add(rotations[rotateFrom]);

        // console.log(`${rotateFrom} → ${rotateTo}`);

        lastRotationPhase = rotationPhase;

        // Additional fanciness
        // material.wireframe = !material.wireframe;
    }

    // renderer.render( scene, camera );
    renderer.render( scene, cameraOrtho );
}

if ( WebGL.isWebGLAvailable() ) {
    animate();
} else {
    console.error('WebGL is not available');
    const warning = WebGL.getWebGLErrorMessage();
    document.body.appendChild( warning );
}



/**
 * Extrude shape mesh from SVG paths.
 *
 * Usage:
 * MeshFromPath( (new SVGLoader).parse() )
 *      .forEach( mesh => group.add(mesh) );
 *
 *
 * @param svgPath {ShapePath|ShapePath[]}
 * @param centerOrigin {boolean} Center origin inside bounding box.
 *              Useful to ease rotations. Eliminating the need of translation or position move after rotation.
 * @param material {Material}
 * @returns {Mesh[]}
 *
 * @__PURE__
 */
function MeshFromPath(svgPath, centerOrigin = false, material = null) {
    if (material === null) {
        material = new MeshNormalMaterial({wireframe: true});
    }

    if (Array.isArray(svgPath)) {
        return svgPath.reduce(
            (acc, p) => acc.concat(MeshFromPath(p, centerOrigin, material)),
            []
        );
    }

    // Note: To correctly extract holes, use SVGLoader.createShapes(), not path.toShapes()
    /**
     * @type {Shape[]}
     */
    const pathShapes = svgPath.toShapes(false, true);
    // const pathShapes = SVGLoader.createShapes(svgPath);

    if (pathShapes.length === 0 || !pathShapes[0]) {
        return [];
    }

    /**
     * @type {Mesh}
     */
    let mesh;

    // Get base shape width to determine extrusion depth
    const [w] = getShapeSize(pathShapes[0]);

    // Each path has an array of shapes
    pathShapes.forEach((shape, ind) => {
        // Take each shape and extrude it
        shape.closePath();

        let geometry = new ExtrudeGeometry(shape, {
            depth: w,
            bevelEnabled: false
        });

        geometry = mergeVertices(geometry);

        if (ind === 0) {
            // Initial shape
            mesh = new Mesh(geometry, material);
        } else {
            // Cut-out holes.
            mesh = bhvCsgSubtract(mesh, new Mesh(geometry, material));
        }
        mesh.matrixAutoUpdate = false;
    });

    // Upon importing SVGs, paths are inverted on the Y axis.
    // It happens in the process of coordinate system mapping from 2d to 3d.
    // Important to scale geometry by two axis to not get inside-out shape.

    mesh.geometry.scale(1, -1, -1);

    // Reset origin to the center of the bounding box. To be able to rotate mesh around the center later.
    mesh.geometry.center();

    return [mesh];
}


/**
 *
 * @param mesh1 {Mesh}
 * @param mesh2 {Mesh}
 * @returns {Mesh}
 */
function csgSubtract(mesh1, mesh2) {
    return CSG.subtract(mesh1, mesh2);
}

/**
 *
 * @param mesh1 {Mesh}
 * @param mesh2 {Mesh}
 * @returns {Mesh}
 */
function csgIntersect(mesh1, mesh2) {
    return CSG.intersect(mesh1, mesh2);
}


/**
 *
 * @param mesh1 {Mesh}
 * @param mesh2 {Mesh}
 * @returns {Mesh}
 */
function bhvCsgSubtract(mesh1, mesh2) {
    const csgEvaluator = new Evaluator();

    // three-bvh-csg: It is recommended to remove groups from a geometry before creating a brush if multi-material support is not required.
    mesh1.geometry.groups = [];
    mesh2.geometry.groups = [];

    mesh1.updateMatrix();
    mesh2.updateMatrix();

    return csgEvaluator.evaluate(
        new Brush(mesh1.geometry, mesh1.material),
        new Brush(mesh2.geometry, mesh2.material),
        SUBTRACTION
    );
}

/**
 *
 * @param mesh1 {Mesh}
 * @param mesh2 {Mesh}
 * @returns {Mesh}
 */
function bhvCsgIntersect(mesh1, mesh2) {
    const csgEvaluator = new Evaluator();

    // three-bvh-csg: It is recommended to remove groups from a geometry before creating a brush if multi-material support is not required.
    mesh1.geometry.groups = [];
    mesh2.geometry.groups = [];

    mesh1.updateMatrix();
    mesh2.updateMatrix();

    return csgEvaluator.evaluate(
        new Brush(mesh1.geometry, mesh1.material),
        new Brush(mesh2.geometry, mesh2.material),
        INTERSECTION
    );
}


/**
 * Get shape width and height from its []Vector2 coordinates.
 *
 * @param shape {Shape}
 * @returns {[Number, Number]} [Width, Height]
 *
 * @__PURE__
 */
function getShapeSize(shape) {
    const [width, height] = getShapeBbox(shape).getSize(new Vector2());
    return [width, height];
}

/**
 *
 * @param shape {Shape}
 * @returns {Box2}
 */
function getShapeBbox(shape) {
    let maxX = Number.MIN_SAFE_INTEGER,
        maxY = Number.MIN_SAFE_INTEGER,
        minX = Number.MAX_SAFE_INTEGER,
        minY = Number.MAX_SAFE_INTEGER;

    const points = shape.getPoints();

    points.forEach(p => {
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
    });

    return new Box2(
        new Vector2(minX, minY),
        new Vector2(maxX, maxY)
    );
}


/**
 * Get direction quadrant based on absolute rotation angle φ.
 *
 * 0: NE, φ ∈ [0; 1/2π)
 * 1: NW, φ ∈ [1/2π; π)
 * 2: SW, φ ∈ [π; 3/2π)
 * 3: SE, φ ∈ [3/2π; 2π)
 *
 * Note: cardinal points NE/NW/SW/SE are ambiguous “directions”,
 * used just for explainer here.
 * North could not be derived just from the rotation angle.
 *
 * @param obj3d {Object3D}
 * @returns {number}
 * @constructor
 */
function GetRotationQuadrant(obj3d) {
    // Short explainer on Quaternions and Euler angles
    // https://discourse.threejs.org/t/when-i-rotate-an-object-how-do-i-know-its-true-angle-of-rotation/4573/9
    // https://stackoverflow.com/a/34329880/1412330
    const direction = obj3d.getWorldDirection(new Vector3());

    // let a = Math.atan2(-direction.x, direction.z);
    // Convert interval: [-π; π] → [0; 2π)
    // a = ( a + 2 * Math.PI ) % ( 2 * Math.PI );
    // return (a / (Math.PI / 2)) >>> 0;

    // Important to properly map 3D-rotation around Y-axis to 2D coordinates
    // noinspection JSSuspiciousNameCombination
    const x = direction.z;
    // noinspection JSSuspiciousNameCombination
    const y = -direction.x;

    if (y >= 0) {
        return x >= 0 ? 0 : 1;
    } else {
        return x >= 0 ? 3 : 2;
    }
}


function onWindowResize() {
    SCREEN_WIDTH = window.innerWidth;
    SCREEN_HEIGHT = window.innerHeight;
    aspect = SCREEN_WIDTH / SCREEN_HEIGHT;

    renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );

    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    cameraOrtho.left = - 0.5 * frustumSize * aspect;
    cameraOrtho.right = 0.5 * frustumSize * aspect;
    cameraOrtho.top = frustumSize / 2;
    cameraOrtho.bottom = frustumSize / -2;
    cameraOrtho.updateProjectionMatrix();
}


// Debug stuff
const link = document.createElement( 'a' );
link.style.display = 'none';
document.body.appendChild( link );

function save( blob, filename ) {
    link.href = URL.createObjectURL( blob );
    link.download = filename;
    link.click();
}

function saveArrayBuffer( buffer, filename ) {
    save( new Blob( [ buffer ], { type: 'application/octet-stream' } ), filename );
}

function exportStlBinary() {
    const exporter = new STLExporter();

    const result = exporter.parse( meshes[0], { binary: true } );
    saveArrayBuffer( result, '0.stl' );
}

const gui = new GUI();

const params = {
    exportStlBinary: exportStlBinary
};
gui.add( params, 'exportStlBinary' ).name( 'Export STL' );
gui.open();
