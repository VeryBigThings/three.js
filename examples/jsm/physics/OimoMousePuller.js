import { MeshBasicMaterial, Raycaster, Mesh, PlaneGeometry, Vector3, Vector2 } from '../../../build/three.module.js';
import {
	RayCastClosest,
	RigidBody,
	RigidBodyConfig,
	RigidBodyType, SphericalJoint,
	SphericalJointConfig,
	Vec3
} from '../libs/OimoPhysics';


export class OimoMousePuller {

	constructor( world, renderer, controls, scene ) {

		this.inited = true;
		this.controls = controls;
		this.scene = scene;
		this.camera = controls.object;
		this.world = world;
		this.renderer = renderer;
		const rigidBodyConfig = new RigidBodyConfig();
		rigidBodyConfig.type = RigidBodyType.STATIC;
		this.mouseJointDummyBody = new RigidBody( rigidBodyConfig );
		this.mouseJoint = null;
		this.previousSqueezed = false;
		this.raycaster = new Raycaster();

		let squeezed = false, moveCallback, upCallback;

		// pointerdown
		document.addEventListener( 'pointerdown', ( event ) => {

			const intersectedObject = this.raycast( event );

			squeezed = true;
			const position = new Vec3( 0, 0, 0 );

			const ray = this.raycaster.ray.clone();

			const intersected = this.updateMouseJoint(
			    squeezed,
			    position,
			    new Vec3( ray.origin.x, ray.origin.y, ray.origin.z ),
			    new Vec3( ray.direction.x, ray.direction.y, ray.direction.z )
			);

			if ( intersectedObject ) {

				this.controls.enabled = false;
				this.scene.add( this.plane = new Mesh( new PlaneGeometry( 1000, 1000 ), new MeshBasicMaterial( { visible: false } ) ) );
				this.plane.position.set( position.x, position.y, position.z );
				this.plane.lookAt( this.camera.localToWorld( new Vector3() ) );

			}

		} );

		// pointermove
		document.addEventListener( 'pointermove', ( event ) => {

			if ( ! squeezed ) return;

			const intersectedObject = this.raycast( event, this.plane );

			const ray = this.raycaster.ray.clone();

			this.updateMouseJoint(
				squeezed,
				new Vec3( intersectedObject.point.x, intersectedObject.point.y, intersectedObject.point.z ),
				new Vec3( ray.origin.x, ray.origin.y, ray.origin.z ),
				new Vec3( ray.direction.x, ray.direction.y, ray.direction.z )
			);

		} );

		// pointerup
		document.addEventListener( 'pointerup', ( event ) => {

			this.updateMouseJoint( false, new Vec3( null ), new Vec3( null ), new Vec3( null ) );
			this.controls.enabled = true;
			this.scene.remove( this.plane );
			this.plane.geometry.dispose();
			this.plane.material.dispose();
			this.plane = null;
			squeezed = false;

		} );

	}

	raycast( event, object = this.scene ) {

		const mouse = new Vector2();
		const objectsForRaycast = [];

		if ( object.isMesh ) {

			objectsForRaycast.push( this.plane );

		} else {

			this.scene.traverse( el => el.isMesh && objectsForRaycast.push( el ) );

		}

		mouse.x = ( event.layerX / this.renderer.domElement.offsetWidth ) * 2 - 1;
		mouse.y = - ( event.layerY / this.renderer.domElement.offsetHeight ) * 2 + 1;

		this.raycaster.setFromCamera( mouse, this.camera );
		const intersectedObject = this.raycaster.intersectObjects( objectsForRaycast )[ 0 ];

		return intersectedObject;

	}


	updateMouseJoint( squeezed, newWorldPosition, originPoint, direction ) {

		if ( this.mouseJoint !== null ) {

			if ( squeezed ) {

				this.mouseJointDummyBody.setPosition( newWorldPosition );
				this.mouseJoint.getRigidBody1().wakeUp();
				this.mouseJoint.getRigidBody2().wakeUp();

			} else {

				this.world.removeJoint( this.mouseJoint );
				this.mouseJoint = null;

			}

		} else {

			if ( squeezed && ! this.previousSqueezed ) { // clicked

				// ray casting
				const end = originPoint.clone().add( direction.scale( 500 ) );

				const closest = new RayCastClosest();
				this.world.rayCast( originPoint, end, closest );

				if ( ! closest.hit ) return;

				const body = closest.shape.getRigidBody();
				const position = closest.position;
				newWorldPosition.copyFrom( position );

				if ( body == null || body.getType() !== RigidBodyType.DYNAMIC ) return false;

				const jc = new SphericalJointConfig();
				jc.springDamper.frequency = 1;
				jc.springDamper.dampingRatio = 1;
				jc.rigidBody1 = body;
				jc.rigidBody2 = this.mouseJointDummyBody;
				jc.allowCollision = false;
				jc.localAnchor1 = position.sub( body.getPosition() );
				jc.localAnchor1.mulMat3Eq( body.getRotation().transposeEq() );
				jc.localAnchor2.zero();
				this.mouseJointDummyBody.setPosition( position );
				this.mouseJoint = new SphericalJoint( jc );
				this.world.addJoint( this.mouseJoint );

			}

		}

		this.previousSqueezed = squeezed;
		return true;

	}

}
