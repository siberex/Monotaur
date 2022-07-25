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

const material = new MeshNormalMaterial({ wireframe: false });

// Loop through all the parsed paths
svgDataLeft.paths.forEach(path => {
    // Note: To correctly extract holes, use SVGLoader.createShapes(), not path.toShapes()
    const shapes = SVGLoader.createShapes(path);

    shapes.forEach(shape => {
        // Get width from shape []Vector2 coordinates
        const shapeWidth = shape.getPoints().reduce(
            (acc, vec) => vec.width > acc ? vec.width : acc,
            0
        );

        // Finally we can take each shape and extrude it
        const geometry = new ExtrudeGeometry(shape, {
            depth: shapeWidth,
            bevelEnabled: false
        });

        // Create a mesh and add it to the group
        const mesh = new Mesh(geometry, material);
        // const mesh = new Mesh(geometry, new MeshNormalMaterial({ wireframe: true }));
        mesh.updateMatrix();
        group.add(mesh);
    });
});

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


const intersection = CSG.intersect(group.children[0], group.children[1]);

const intersectionGroup = new Group();
intersectionGroup.scale.y *= -1;

intersectionGroup.add(intersection);

// Get group's size
const box = new Box3().setFromObject(intersectionGroup);
let vectorSize = new Vector3();
box.getSize(vectorSize);

// Reverse group scaleFactor for correct children offsetting


// Offset each dimension half its length to center group elements
// vectorSize.multiplyScalar(-0.5);
intersectionGroup.children.forEach((item, i) => {
    // item.position.copy(vectorSize);
    item.translateX(-vectorSize.x / 2);
    item.translateY(-vectorSize.y / 2);
    item.translateZ(-vectorSize.z / 2);
});

// Axes helper
if (DEBUG) {
    const axesHelper = new AxesHelper(1500);
    intersectionGroup.add(axesHelper);
}

// Finally we add svg group to the scene
// scene.add(group);
scene.add(intersectionGroup);


// const geometry = new BoxGeometry( 1, 1, 1 );
// const material = new MeshBasicMaterial( { color: 0x00ff00, wireframe: true } );
// const cube = new Mesh( geometry, material );
// scene.add( cube );

camera.position.z = 2000;

function animate() {
    requestAnimationFrame( animate );

    // group.rotation.y -= 0.01;
    intersectionGroup.rotation.y -= 0.01;

    renderer.render( scene, camera );
}

if ( WebGL.isWebGLAvailable() ) {
    animate();
    console.log('DONE');
} else {
    const warning = WebGL.getWebGLErrorMessage();
    document.body.appendChild( warning );
}
