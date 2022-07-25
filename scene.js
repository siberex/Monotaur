import {
    AxesHelper,
    Box3,
    ExtrudeGeometry,
    Group,
    Mesh,
    MeshNormalMaterial,
    PerspectiveCamera,
    Scene,
    Vector3,
    WebGLRenderer
} from 'three';
import {SVGLoader} from 'three/examples/jsm/loaders/SVGLoader.js';
import WebGL from 'three/examples/jsm/capabilities/WebGL.js';

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
const svgData = loader.parse(svg[0]);

// Group we'll use for all SVG paths
const group = new Group();
// When importing SVGs paths are inverted on Y axis
// it happens in the process of mapping from 2d to 3d coordinate system
group.scale.y *= -1;

const scaleFactor = 0.5;
group.scale.multiplyScalar( scaleFactor );

const material = new MeshNormalMaterial({ wireframe: false });

// Loop through all the parsed paths
svgData.paths.forEach(path => {
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
        group.add(mesh);
    });
});


// Meshes we got are all relative to themselves
// meaning they have position set to (0, 0, 0)
// which makes centering them in the group easy

// Get group's size
const box = new Box3().setFromObject(group);
let vectorSize = new Vector3();
box.getSize(vectorSize);

// Revere group scaleFactor for correct children offsetting
vectorSize.multiplyScalar(1 / scaleFactor);

// Offset each dimension half its length to center group elements
vectorSize.multiplyScalar(-0.5);
group.children.forEach(item => {
    item.position.copy(vectorSize);
});

// Axes helper
if (DEBUG) {
    const axesHelper = new AxesHelper(500);
    group.add(axesHelper);
}

// Finally we add svg group to the scene
scene.add(group);


// const geometry = new BoxGeometry( 1, 1, 1 );
// const material = new MeshBasicMaterial( { color: 0x00ff00, wireframe: true } );
// const cube = new Mesh( geometry, material );
// scene.add( cube );

camera.position.z = 2000;

function animate() {
    requestAnimationFrame( animate );

    group.rotation.y += 0.01;

    renderer.render( scene, camera );
}

if ( WebGL.isWebGLAvailable() ) {
    animate();
    console.log('DONE');
} else {
    const warning = WebGL.getWebGLErrorMessage();
    document.body.appendChild( warning );
}
