import {
	Vec3,
	World,
	RigidBodyType,
	RigidBodyConfig,
	ShapeConfig,
	RigidBody,
	Shape,
	OBoxGeometry,
	OSphereGeometry,
	PrismaticJointConfig,
	PrismaticJoint,
	CylindricalJointConfig,
	CylindricalJoint,
	SphericalJoint,
	SphericalJointConfig,
	RagdollJoint, MathUtil, RagdollJointConfig, UniversalJointConfig, UniversalJoint, RevoluteJoint, RevoluteJointConfig
} from '../libs/OimoPhysics';
import { OimoPhysicsDebugger } from './OimoPhysicsDebugger.js';

/**
 * OimoPhysics helper constructor
 * @param {boolean} enableDebug If true, debug will be added to the World and returned
 * @return {Promise<{addMesh: addMesh, setMeshPosition: setMeshPosition, debugDraw?: DebugDraw}>}
 * @constructor
 */
async function OimoPhysics( enableDebug ) {

	const frameRate = 60;

	const world = new World( 2, new Vec3( 0, - 9.8, 0 ) );
	let oimoDebugger;

	if ( !! enableDebug ) {

		oimoDebugger = await OimoPhysicsDebugger();
		world.setDebugDraw( oimoDebugger.debugDraw );
		console.log( 'oimoDebugger', oimoDebugger.debugDraw );

	}

	//

	function getShape( geometry ) {

		const parameters = geometry.parameters;

		// TODO change type to is*

		if ( geometry.type === 'BoxGeometry' ) {

			const sx = parameters.width !== undefined ? parameters.width / 2 : 0.5;
			const sy = parameters.height !== undefined ? parameters.height / 2 : 0.5;
			const sz = parameters.depth !== undefined ? parameters.depth / 2 : 0.5;

			return new OBoxGeometry( new Vec3( sx, sy, sz ) );

		} else if ( geometry.type === 'SphereGeometry' || geometry.type === 'IcosahedronGeometry' ) {

			const radius = parameters.radius !== undefined ? parameters.radius : 1;

			return new OSphereGeometry( radius );

		}

		return null;

	}

	const meshes = [];
	const meshMap = new WeakMap();

	function addMesh( mesh, mass = 0 ) {

		const shape = getShape( mesh.geometry );

		if ( shape !== null ) {

			if ( mesh.isInstancedMesh ) {

				handleInstancedMesh( mesh, mass, shape );

			} else if ( mesh.isMesh ) {

				return handleMesh( mesh, mass, shape );

			}

		}

	}

	function handleMesh( mesh, mass, shape ) {

		const shapeConfig = new ShapeConfig();
		shapeConfig.geometry = shape;

		const bodyConfig = new RigidBodyConfig();
		bodyConfig.type = mass === 0 ? RigidBodyType.STATIC : RigidBodyType.DYNAMIC;
		bodyConfig.position = new Vec3( mesh.position.x, mesh.position.y, mesh.position.z );

		const body = new RigidBody( bodyConfig );
		body.addShape( new Shape( shapeConfig ) );
		world.addRigidBody( body );

		if ( mass > 0 ) {

			meshes.push( mesh );
			meshMap.set( mesh, body );

		}

		return body;

	}

	function handleInstancedMesh( mesh, mass, shape ) {

		const array = mesh.instanceMatrix.array;

		const bodies = [];

		for ( let i = 0; i < mesh.count; i ++ ) {

			const index = i * 16;

			const shapeConfig = new ShapeConfig();
			shapeConfig.geometry = shape;

			const bodyConfig = new RigidBodyConfig();
			bodyConfig.type = mass === 0 ? RigidBodyType.STATIC : RigidBodyType.DYNAMIC;
			bodyConfig.position = new Vec3( array[ index + 12 ], array[ index + 13 ], array[ index + 14 ] );

			const body = new RigidBody( bodyConfig );
			body.addShape( new Shape( shapeConfig ) );
			world.addRigidBody( body );

			bodies.push( body );

		}

		if ( mass > 0 ) {

			meshes.push( mesh );
			meshMap.set( mesh, bodies );

		}

	}

	//

	function setMeshPosition( mesh, position, index = 0 ) {

		if ( mesh.isInstancedMesh ) {

			const bodies = meshMap.get( mesh );
			const body = bodies[ index ];

			body.setPosition( new Vec3( position.x, position.y, position.z ) );

		} else if ( mesh.isMesh ) {

			const body = meshMap.get( mesh );

			body.setPosition( new Vec3( position.x, position.y, position.z ) );

		}

	}

	// Joints

	function addPrismaticJoint( rb1, rb2, anchor, axis, sd = null, lm = null ) {

		const jc = new PrismaticJointConfig();
		jc.init( rb1, rb2, anchor, axis );
		if ( sd != null ) jc.springDamper = sd;
		if ( lm != null ) jc.limitMotor = lm;
		const j = new PrismaticJoint( jc );
		world.addJoint( j );
		return j;

	}

	function addCylindricalJoint( rb1, rb2, anchor, axis, rotSd = null, rotLm = null, traSd = null, traLm = null ) {

		const jc = new CylindricalJointConfig();
		jc.init( rb1, rb2, anchor, axis );
		if ( rotSd != null ) jc.rotationalSpringDamper = rotSd;
		if ( rotLm != null ) jc.rotationalLimitMotor = rotLm;
		if ( traSd != null ) jc.translationalSpringDamper = traSd;
		if ( traLm != null ) jc.translationalLimitMotor = traLm;
		const j = new CylindricalJoint( jc );
		world.addJoint( j );
		return j;

	}

	function addSphericalJoint( rb1, rb2, anchor ) {

		const jc = new SphericalJointConfig();
		jc.init( rb1, rb2, anchor );
		const j = new SphericalJoint( jc );
		world.addJoint( j );
		return j;

	}

	function addSphericalJoint2( rb1, rb2, localAnchor1, localAnchor2 ) {

		const jc = new SphericalJointConfig();
		jc.localAnchor1.copyFrom( localAnchor1 );
		jc.localAnchor2.copyFrom( localAnchor2 );

		jc.rigidBody1 = rb1;
		jc.rigidBody2 = rb2;

		const j = new SphericalJoint( jc );
		world.addJoint( j );
		return j;

	}

	function addRagdollJoint( rb1, rb2, anchor, twistAxis, swingAxis, swingSd = null, maxSwing1Deg = 180, maxSwing2Deg = 180, twistSd = null, twistLm = null ) {

		rb1.getRotation().transpose(); // ?
		rb2.getRotation().transpose(); // ?
		const jc = new RagdollJointConfig();
		jc.init( rb1, rb2, anchor, twistAxis, swingAxis );
		if ( twistSd != null ) jc.twistSpringDamper = twistSd;
		if ( twistLm != null ) jc.twistLimitMotor = twistLm;
		if ( swingSd != null ) jc.swingSpringDamper = swingSd;
		jc.maxSwingAngle1 = maxSwing1Deg * MathUtil.TO_RADIANS;
		jc.maxSwingAngle2 = maxSwing2Deg * MathUtil.TO_RADIANS;
		const j = new RagdollJoint( jc );
		world.addJoint( j );
		return j;

	}

	function addUniversalJoint( rb1, rb2, anchor, axis1, axis2, sd1 = null, lm1 = null, sd2 = null, lm2 = null ) {

		rb1.getRotation().transpose(); // ?
		rb2.getRotation().transpose(); // ?
		const jc = new UniversalJointConfig();
		jc.init( rb1, rb2, anchor, axis1, axis2 );
		if ( sd1 != null ) jc.springDamper1 = sd1;
		if ( lm1 != null ) jc.limitMotor1 = lm1;
		if ( sd2 != null ) jc.springDamper2 = sd2;
		if ( lm2 != null ) jc.limitMotor2 = lm2;
		const j = new UniversalJoint( jc );
		world.addJoint( j );
		return j;

	}

	function addRevoluteJoint( rb1, rb2, anchor, axis, sd = null, lm = null ) {

		const jc = new RevoluteJointConfig();
		jc.init( rb1, rb2, anchor, axis );
		if ( sd != null ) jc.springDamper = sd;
		if ( lm != null ) jc.limitMotor = lm;
		const j = new RevoluteJoint( jc );
		world.addJoint( j );
		return j;

	}

	function addRevoluteJoint2( rb1, rb2, localAnchor1, localAnchor2, localAxis1, localAxis2, sd = null, lm = null ) {

		const jc = new RevoluteJointConfig();
		jc.rigidBody1 = rb1;
		jc.rigidBody2 = rb2;

		jc.localAnchor1.copyFrom( localAnchor1 );
		jc.localAnchor2.copyFrom( localAnchor2 );

		jc.localAxis1.copyFrom( localAxis1 );
		jc.localAxis2.copyFrom( localAxis2 );

		if ( sd != null ) jc.springDamper = sd;
		if ( lm != null ) jc.limitMotor = lm;
		const j = new RevoluteJoint( jc );
		world.addJoint( j );
		return j;

	}


	//

	let lastTime = 0;

	function step() {

		const time = performance.now();

		if ( lastTime > 0 ) {

			oimoDebugger.generateGeometries();
			oimoDebugger.clearBuffers();

			// console.time( 'world.step' );
			world.step( 1 / frameRate );
			world.debugDraw();
			// console.timeEnd( 'world.step' );

		}

		lastTime = time;

		//

		for ( let i = 0, l = meshes.length; i < l; i ++ ) {

			const mesh = meshes[ i ];

			if ( mesh.isInstancedMesh ) {

				const array = mesh.instanceMatrix.array;
				const bodies = meshMap.get( mesh );

				for ( let j = 0; j < bodies.length; j ++ ) {

					const body = bodies[ j ];

					compose( body.getPosition(), body.getOrientation(), array, j * 16 );

				}

				mesh.instanceMatrix.needsUpdate = true;

			} else if ( mesh.isMesh ) {

				const body = meshMap.get( mesh );

				mesh.position.copy( body.getPosition() );
				mesh.quaternion.copy( body.getOrientation() );

			}

		}

	}

	// animate

	setInterval( step, 1000 / frameRate );

	return {
		addMesh: addMesh,
		setMeshPosition: setMeshPosition,
		debugDraw: oimoDebugger,
		addPrismaticJoint: addPrismaticJoint,
		addCylindricalJoint: addCylindricalJoint,
		addSphericalJoint: addSphericalJoint,
		addSphericalJoint2: addSphericalJoint2,
		addRagdollJoint: addRagdollJoint,
		addUniversalJoint: addUniversalJoint,
		addRevoluteJoint: addRevoluteJoint,
		addRevoluteJoint2: addRevoluteJoint2,
		world: world,
		// addCompoundMesh
	};

}

function compose( position, quaternion, array, index ) {

	const x = quaternion.x, y = quaternion.y, z = quaternion.z, w = quaternion.w;
	const x2 = x + x, y2 = y + y, z2 = z + z;
	const xx = x * x2, xy = x * y2, xz = x * z2;
	const yy = y * y2, yz = y * z2, zz = z * z2;
	const wx = w * x2, wy = w * y2, wz = w * z2;

	array[ index + 0 ] = ( 1 - ( yy + zz ) );
	array[ index + 1 ] = ( xy + wz );
	array[ index + 2 ] = ( xz - wy );
	array[ index + 3 ] = 0;

	array[ index + 4 ] = ( xy - wz );
	array[ index + 5 ] = ( 1 - ( xx + zz ) );
	array[ index + 6 ] = ( yz + wx );
	array[ index + 7 ] = 0;

	array[ index + 8 ] = ( xz + wy );
	array[ index + 9 ] = ( yz - wx );
	array[ index + 10 ] = ( 1 - ( xx + yy ) );
	array[ index + 11 ] = 0;

	array[ index + 12 ] = position.x;
	array[ index + 13 ] = position.y;
	array[ index + 14 ] = position.z;
	array[ index + 15 ] = 1;

}


export { OimoPhysics };
