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
import { CSG } from 'three-csg-ts';

import {shuffle} from './utils.js';


// Animation rotation direction (false = CW, true = CCW)
const ROTATE_CCW = false;

// Rotation around Y-axis, which is directed from bottom to top
const INTERSECTION_ANGLE = MathUtils.degToRad(90)  * (ROTATE_CCW ? -1 : 1);
// Rotation speed: turn this amount with each animation  frame
const ROTATION_STEP = MathUtils.degToRad(1) * (ROTATE_CCW ? 1 : -1);


let SCREEN_WIDTH = window.innerWidth;
let SCREEN_HEIGHT = window.innerHeight;
let aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
const frustumSize = 2000;

// Init three.js scene
const scene = new Scene();
// https://threejs.org/docs/#api/en/cameras/PerspectiveCamera
const camera = new PerspectiveCamera( 15, aspect, 0.1, 20000 );
camera.position.z = 8000;
// camera.rotateX(0.5)
// camera.position.y = -1000;

// https://threejs.org/docs/#api/en/cameras/OrthographicCamera
const cameraOrtho = new OrthographicCamera(- 0.5 * frustumSize * aspect, 0.5 * frustumSize * aspect, frustumSize / 2, frustumSize / -2, 0.1, 10000);
cameraOrtho.position.z = 5000;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
document.body.appendChild( renderer.domElement );

// Resize and update camera
window.addEventListener('resize', onWindowResize);


// Load SVG, extrude surface from SVG paths and Binary Intersect resulting Meshes
// https://threejs.org/docs/#examples/en/loaders/SVGLoader
const loader = new SVGLoader();
const material = new MeshNormalMaterial({ wireframe: false });


/**
 * @type {string[]}
 */
const svg = [
    'M0 1100V0h660v1100H0Zm220-220V220h220v660H220Z',
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

// shuffle(meshes);

/**
 * Produce Boolean Intersection for Meshes extruded from SVG.
 *
 * 1. Get extruded Mesh.
 * 2. Get adjacent Mesh from the list and rotate it 90 deg along its vertical axis.
 * 3. Boolean Intersect two meshes.
 *
 * @type {Mesh[]}
 */
const IntersectionMeshes = meshes.map((mesh, i, items) => {
    const nextIndex = (i + 1) % items.length;

    const meshRotated = items[nextIndex].clone();
    meshRotated.rotateY( INTERSECTION_ANGLE );
    meshRotated.updateMatrix();

    return CSG.intersect(mesh, meshRotated);
});

// Group we'll use for all SVG paths
const group = new Group();

// group.add(meshes[3]);
let modelIndex = 0;
group.add(IntersectionMeshes[modelIndex]);

// group.add(new AxesHelper(1500));

// Add intersection result to the scene
scene.add(group);


const activeQuadrant = ROTATE_CCW ? 3 : 0;
let lastRotationPhase = activeQuadrant;
const initialRotation = group.rotation.y;


function animate() {
    requestAnimationFrame( animate );

    group.rotateY(ROTATION_STEP);

    let rotationPhase = GetRotationQuadrant(group);

    // Switch models every 90° of rotation
    if (rotationPhase !== lastRotationPhase) {
        // console.log(rotationPhase);

        group.remove(IntersectionMeshes[modelIndex]);

        // Reset rotation
        group.rotation.y = initialRotation;

        // Switch to the next model in list
        modelIndex = (modelIndex + 1) % IntersectionMeshes.length;
        group.add(IntersectionMeshes[modelIndex]);

        // lastRotationPhase = rotationPhase;
        lastRotationPhase = activeQuadrant;

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
        // Get width from shape []Vector2 coordinates
        const shapeWidth = shape.getPoints().reduce(
            (acc, vec) => vec.width > acc ? vec.width : acc,
            0
        );

        // Take each shape and extrude it
        const geometry = new ExtrudeGeometry(shape, {
            depth: shapeWidth,
            bevelEnabled: false
        });

        // Upon importing SVGs, paths are inverted on the Y axis.
        // It happens in the process of coordinate system mapping from 2d to 3d
        geometry.scale(1, -1, -1);
        geometry.translate(0,1100,660);

        if (centerOrigin) {
            // Get bounding box
            geometry.computeBoundingBox();
            let vectorSize = new Vector3();
            geometry.boundingBox.getSize(vectorSize);

            // Offset each dimension half its length to center origin inside bounding box
            geometry.translate(vectorSize.x/-2, vectorSize.y/-2, vectorSize.z/-2);
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
 * 0: NE, φ ∈ [0; ½π)
 * 1: NW, φ ∈ [½π; π)
 * 2: SW, φ ∈ [π; ¾π)
 * 3: SE, φ ∈ [¾π; 2π)
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
    const direction = new Vector3();
    const PI = Math.PI;

    // Short explainer on Quaternions and Euler angles
    // https://discourse.threejs.org/t/when-i-rotate-an-object-how-do-i-know-its-true-angle-of-rotation/4573/9
    // https://stackoverflow.com/a/34329880/1412330
    obj3d.getWorldDirection(direction);
    let a = Math.atan2(direction.x, direction.z);

    // Convert interval: [-π; π] → a.b → b.a → [0; 2π)
    // a = ( a + 2 * PI ) % ( 2 * PI ); // CW
    a = Math.abs(( a - 2 * PI ) % ( 2 * PI ) ); // CCW

    if (0 <= a && a < PI / 2) {
        return 0;
    } else if (PI / 2 <= a && a < PI) {
        return 1;
    } else if (PI <= a && a < PI + PI / 2) {
        return 2;
    } else if (PI + PI / 2 <= a && a < 2 * PI) {
        return 3;
    }

    return 0;
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
