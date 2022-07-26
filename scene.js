import {
    AxesHelper,
    Box3,
    ExtrudeGeometry,
    Group,
    MathUtils,
    Mesh,
    MeshNormalMaterial,
    PerspectiveCamera,
    Scene,
    Vector3,
    WebGLRenderer
} from 'three';
import {SVGLoader} from 'three/examples/jsm/loaders/SVGLoader.js';
import WebGL from 'three/examples/jsm/capabilities/WebGL.js';
import { CSG } from 'three-csg-ts';

import {svg} from './data.js';

const DEBUG = true;

// Init three.js scene
const scene = new Scene();
const camera = new PerspectiveCamera( 20, window.innerWidth / window.innerHeight, 0.1, 10000 );

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// Resize and update camera
window.addEventListener('resize', function(e) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
});


// Load SVG and extrude surface from SVG paths
// https://threejs.org/docs/#examples/en/loaders/SVGLoader
const loader = new SVGLoader();
const svgDataLeft = loader.parse(svg[1]);
const svgDataRight = loader.parse(svg[2]);

// Group we'll use for all SVG paths
const group = new Group();
// When importing SVGs paths are inverted on Y axis
// it happens in the process of mapping from 2d to 3d coordinate system
group.scale.y *= -1;

const scaleFactor = 0.5;
group.scale.multiplyScalar( scaleFactor );


/**
 * Extrude shape mesh from SVG paths.
 *
 * Usage:
 * MeshFromPath( (new SVGLoader).parse() )
 *      .forEach( mesh => group.add(mesh) );
 *
 *
 * @param svgPath {ShapePath|ShapePath[]}
 * @param rotate {boolean}
 * @returns {Mesh[]}
 * @pure
 */
function MeshFromPath(svgPath, rotate = false) {
    const material = new MeshNormalMaterial({ wireframe: false });
    const rightAngle = MathUtils.degToRad(90);

    if (Array.isArray(svgPath)) {
        return svgPath.reduce(
            (acc, p) => acc.concat(MeshFromPath(p, rotate)),
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

        if (rotate) {
            // Rotate geometry, not mesh
            geometry.rotateY(rightAngle);
        }

        const mesh = new Mesh(geometry, material);

        if (rotate) {
            // Shift along z-axis after rotation, to align inside original boundaries
            mesh.position.z = shapeWidth;
        }

        mesh.updateMatrix();

        result.push(mesh)
    });

    return result;
}


MeshFromPath(svgDataLeft.paths).forEach(mesh => group.add(mesh));
MeshFromPath(svgDataRight.paths, true).forEach(mesh => group.add(mesh));


svgDataRight.paths.forEach(path => {
    const shapes = SVGLoader.createShapes( path );

    // Each path has an array of shapes
    shapes.forEach(shape => {
        // Get width from shape []Vector2 coordinates
        // Use extractPoints().shape to skip holes
        const shapeWidth = shape.extractPoints().shape.reduce(
            (acc, vec) => vec.width > acc ? vec.width : acc,
            0
        );

        const intersection = CSG.intersect(group.children[0], group.children[1]);

const intersectionGroup = new Group();
intersectionGroup.scale.y *= -1;

intersectionGroup.add(intersection);


// Finally we can take each shape and extrude it
        const geometry = new ExtrudeGeometry(shape, {
            depth: shapeWidth,
            bevelEnabled: false
        });

        // Rotate geometry, non mesh
        geometry.rotateY(MathUtils.degToRad(90));

        // Create a mesh and add it to the group
        const mesh = new Mesh(geometry, material);

        // X = red
        // Y = green
        // Z = blue

        // Shift along z-axis after rotation
        mesh.position.z = 660;
        mesh.updateMatrix();
        group.add(mesh);
    });
});


const intersection = CSG.intersect(...group.children);

const intersectionGroup = new Group();
intersectionGroup.scale.y *= -1;

intersectionGroup.add(intersection);

// Get group's size
const box = new Box3().setFromObject(intersectionGroup);
let vectorSize = new Vector3();
box.getSize(vectorSize);

// Offset each dimension half its length to center group elements
// vectorSize.multiplyScalar(-0.5);
intersectionGroup.children.forEach(item => {
    item.translateOnAxis(vectorSize, -1/2);
});

// Axes helper
if (DEBUG) {
    const axesHelper = new AxesHelper(1500);
    intersectionGroup.add(axesHelper);
}

// Add intersection result to the scene
scene.add(intersectionGroup);

camera.position.z = 2000;

const rotationStep = MathUtils.degToRad(-0.6);

function animate() {
    requestAnimationFrame( animate );

    intersectionGroup.rotation.y += rotationStep;

    renderer.render( scene, camera );
}

if ( WebGL.isWebGLAvailable() ) {
    animate();
    console.log('DONE');
} else {
    const warning = WebGL.getWebGLErrorMessage();
    document.body.appendChild( warning );
}
