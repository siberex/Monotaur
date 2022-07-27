# Monotaur

Exploration project to check Three.js features and capabilities.

❇️ [Codepen Demo](https://codepen.io/siberex/full/RwMLKjQ)


## How it works

1. Load SVG shapes (2D).

2. Extrude 3D surfaces from SVG shapes.

    It is like making an I-beam surface from an `I` shape.

    Or like creating a ring surface from an `O` shape, which is technically speaking is called extruding annular cylinder from an annulus :-)

3. For each pair of extruded surfaces find their [Boolean Intersection](https://en.wikipedia.org/wiki/Constructive_solid_geometry).

    One surface is rotated 90-degree against the other before computing intersection.

    Surface intersections are computed using BSP (binary space partitioning), and thankfully there are existing solutions for that:

    - https://github.com/Jiro-Digital/three-csg-ts
    - https://github.com/sshirokov/ThreeBSP

4. Resulting surface mesh is animated by rotating around vertical axis.

5. After completing quarter-circle revolution 3D-mesh is switched to the next one to achieve smooth transition.
