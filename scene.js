import {BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, WebGLRenderer} from 'three';
import WebGL from './node_modules/three/examples/jsm/capabilities/WebGL.js';

import {svg} from './data.js';

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

// Render shapes
const geometry = new BoxGeometry( 1, 1, 1 );
const material = new MeshBasicMaterial( { color: 0x00ff00, wireframe: true } );
const cube = new Mesh( geometry, material );
scene.add( cube );

camera.position.z = 5;

function animate() {
    requestAnimationFrame( animate );

    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    renderer.render( scene, camera );
}

if ( WebGL.isWebGLAvailable() ) {
    animate();
    console.log('DONE');
} else {
    const warning = WebGL.getWebGLErrorMessage();
    document.body.appendChild( warning );
}
