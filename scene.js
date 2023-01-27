import {
    AxesHelper,
    ExtrudeGeometry,
    Group,
    MathUtils,
    Mesh,
    MeshNormalMaterial,
    OrthographicCamera,
    PerspectiveCamera,
    Scene,
    Vector3,
    WebGLRenderer
} from 'three';
import {SVGLoader} from 'three/examples/jsm/loaders/SVGLoader.js';
import WebGL from 'three/examples/jsm/capabilities/WebGL.js';
import { INTERSECTION, Brush, Evaluator } from 'three-bvh-csg';

import {csv, randomInt} from './utils.js';

// Animation rotation direction (false = CW, true = CCW)
const ROTATE_CCW = false;

// Rotation around Y-axis, which is directed from bottom to top
const INTERSECTION_ANGLE = MathUtils.degToRad(90) * (ROTATE_CCW ? -1 : 1);
// Rotation speed: turn this amount with each animation  frame
const ROTATION_STEP = MathUtils.degToRad(1.5) * (ROTATE_CCW ? 1 : -1);


let SCREEN_WIDTH = window.innerWidth;
let SCREEN_HEIGHT = window.innerHeight;
let aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
const frustumSize = 2000;

// Init three.js scene
const scene = new Scene();

// https://threejs.org/docs/#api/en/cameras/PerspectiveCamera
const camera = new PerspectiveCamera( 15, aspect, 0.1, 20000 );
camera.position.z = 8000;
// camera.position.y = 1000;

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
const material = new MeshNormalMaterial({ wireframe: false });


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
 * @type {Mesh[]}
 */
const meshes = svgData.map(svgResult => {
    const meshList = MeshFromPath(svgResult.paths, true, material);
    return meshList[0] ? meshList[0] : null;
}).filter(Boolean);

/**
 * Get right-angle rotations along vertical axis for all meshes.
 * Used for Boolean Intersections later.
 *
 * @type {Mesh[]}
 */
const rotations = meshes.map(mesh => {
    const rotated = mesh.clone().rotateY( INTERSECTION_ANGLE );
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
const csgEvaluator = new Evaluator();
for (let i = 0; i < meshes.length; i++) {
    let pairs = [];
    for (let j = 0; j < rotations.length; j++) {
        const meshIntersection = csgEvaluator.evaluate(
            new Brush( meshes[i].geometry ),
            new Brush( rotations[j].geometry ),
            INTERSECTION
        );

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

// group.add(new AxesHelper(1500));

// Group to rotate
const rotationGroup = new Group();
rotationGroup.add(group);
// rotationGroup.add(new AxesHelper(1500));

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

        // Reset rotation by reverse-rotating newly-added model back to origin,
        // because rotationGroup were rotated by 90 degrees.
        group.rotateY(INTERSECTION_ANGLE);

        // Rotation to the next random digit
        rotateFrom = rotateTo
        // rotateTo = randomInt(10);
        rotateTo = (rotateTo + 1) % 10;
        group.add(intersections[rotateFrom][rotateTo]);

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
    const shapes = SVGLoader.createShapes(svgPath);

    let result = [];

    // Each path has an array of shapes
    shapes.forEach(shape => {
        // Get shape width and height from its []Vector2 coordinates
        // Note: width and height will include translation length from [0, 0] for translated shapes
        // Example: <path d="M55,990L110,1100L0,1100Z"/>
        //          Dimensions will be [110, 1100] and not [110, 110]
        const [shapeWidth, shapeHeight] = shape.getPoints().reduce(
            (acc, vec) => {
                if (vec.width > acc[0]) acc[0] = vec.width;
                if (vec.height > acc[1]) acc[1] = vec.height;
                return acc;
            },
            [0, 0]
        );

        // Take each shape and extrude it
        const geometry = new ExtrudeGeometry(shape, {
            depth: shapeWidth,
            bevelEnabled: false
        });

        // Upon importing SVGs, paths are inverted on the Y axis.
        // It happens in the process of coordinate system mapping from 2d to 3d
        geometry.scale(1, -1, -1);
        geometry.translate(0, shapeHeight, shapeWidth);

        if (centerOrigin) {
            // Get actual bounding box:
            // geometry.computeBoundingBox();
            // const bbox = geometry.boundingBox.getSize(new Vector3());

            // Offset each dimension half its length to center origin inside bounding box
            geometry.translate(shapeWidth/-2, shapeHeight/-2, shapeWidth/-2);
        }

        const mesh = new Mesh(geometry, material);

        mesh.updateMatrix();

        result.push(mesh)
    });

    return result;
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
