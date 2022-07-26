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

/**
 * Parse all SVG text chunks.
 *
 * @type {SVGResult[]}
 */
const svgData = svg.map(loader.parse);

/**
 * Produce Boolean Intersection for Meshes extruded from SVG.
 *
 * 1. Extrude Meshes for set of SVG paths.
 * 2. Get first Mesh.
 * 3. Extrude Meshes for next set of SVG paths and rotate along vertical axis 90 deg.
 * 4. Get first Mesh.
 * 5. Boolean Intersect produced meshes.
 *
 * @type {Mesh[]}
 */
const IntersectionMeshes = svgData.map((svgResult, i, items) => {
    const nextIndex = (i + 1) % items.length;

    const meshList = MeshFromPath(svgResult.paths);
    const meshListNextRotated = MeshFromPath(svgData[nextIndex].paths, true);

    if (!meshList[0] || !meshListNextRotated[0]) {
        return false;
    }

    return CSG.intersect(meshList[0], meshListNextRotated[0]);
}).filter(Boolean);

// Group we'll use for all SVG paths
const group = new Group();
// When importing SVGs paths are inverted on Y axis
// it happens in the process of mapping from 2d to 3d coordinate system
group.scale.y *= -1;

const meshes = MeshFromPath(loader.parse(svg[4]).paths);
const mesh = meshes[0];

// const meshRotated = MeshFromPath(loader.parse(svg[5]).paths)[0];
// meshRotated.geometry.rotateY( MathUtils.degToRad(90) ); // note scaleY -1 !
// meshRotated.translateZ(660);

// group.add(mesh);
group.add(IntersectionMeshes[1]);
// group.add(meshRotated);



// Boolean Intersection
// const intersection = CSG.intersect(mesh, meshRotated);

const intersectionGroup = group;

// const intersectionGroup = new Group();
// intersectionGroup.scale.y *= -1;

//intersectionGroup.add(intersection);
//intersectionGroup.remove(intersection);

// Get group's size
const box = new Box3().setFromObject(intersectionGroup);
let vectorSize = new Vector3();
box.getSize(vectorSize);

// Offset each dimension half its length to center group elements
intersectionGroup.children.forEach(item => {
    item.translateY(vectorSize.y/-2)
    // item.translateOnAxis(vectorSize, -1/2);
});

// Axes helper
const axesHelper = new AxesHelper(1500);
intersectionGroup.add(axesHelper);

// Add intersection result to the scene
scene.add(intersectionGroup);



const rotationStep = MathUtils.degToRad(-0.3);

intersectionGroup.rotation.y = MathUtils.degToRad(30);

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
