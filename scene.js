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

// Init three.js scene
const scene = new Scene();
// https://threejs.org/docs/#api/en/cameras/PerspectiveCamera
const camera = new PerspectiveCamera( 20, window.innerWidth / window.innerHeight, 0.1, 10000 );
camera.position.z = 5000;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// Resize and update camera
window.addEventListener('resize', function(e) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
});


// Load SVG, extrude surface from SVG paths and Binary Intersect resulting Meshes
// https://threejs.org/docs/#examples/en/loaders/SVGLoader
const loader = new SVGLoader();
const material = new MeshNormalMaterial({wireframe: false});

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
    meshRotated.rotateY( MathUtils.degToRad(-90) ); // note scaleY(-1) applied later to the group
    meshRotated.updateMatrix();

    return CSG.intersect(mesh, meshRotated);
});

// Group we'll use for all SVG paths
const group = new Group();
// When importing SVGs paths are inverted on Y axis
// it happens in the process of mapping from 2d to 3d coordinate system
group.scale.y *= -1;

// group.add(meshes[4]);
group.add(IntersectionMeshes[1]);


// Axes helper
// const axesHelper = new AxesHelper(1500);
// intersectionGroup.add(axesHelper);

// Add intersection result to the scene
scene.add(group);



const rotationStep = MathUtils.degToRad(-0.3);

// group.rotation.y = MathUtils.degToRad(30);

function animate() {
    requestAnimationFrame( animate );

    group.rotation.y += rotationStep;

    renderer.render( scene, camera );
}

if ( WebGL.isWebGLAvailable() ) {
    animate();
    console.log('DONE');
} else {
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
 * @pure
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

        if (centerOrigin) {
            // Get bounding box
            geometry.computeBoundingBox();
            // const box = new Box3().setFromObject(geometry);
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
