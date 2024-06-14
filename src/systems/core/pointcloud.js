/**
 * @fileoverview Handle PointCloud from MQTT
 *
 * @date 2024/06/12
 */

// 'use strict';

//import { proxy, wrap } from 'comlink'; // for worker - main communcation

import { ARENA_EVENTS, ACTIONS } from '../../constants';


AFRAME.registerComponent('pcdlog', {

    init: function () {
        console.log("HelloWorld2 ");
    }

})


/* PointCloud のためのコンポーネント */
AFRAME.registerComponent('pointcloud', {
    schema: {
        color: {
            type: 'color',
            default: "#888"
        },
        size: {
            type: 'number',
            default: 0.55
        },
        perspective: {
            type: 'boolean',
            default: false
        }
    },

    init: function (data) {
        this.points = null;
        //        console.log("PointCould data", data)
        //        console.log("Geometry?", this.geometry)
        console.log("pointcloud component", this.el)
        //        console.log("len", GlobalPointCloud.length)

    },
    update: function () {
        const { el } = this;
        const self = this;
        //        console.log("Update Pointcloud geom", el)
        //console.log("Update Pointcloud geom", el.geometry, el.component, el.object3D)

        //        el.setObject3D('mesh', self.points);

    },
    remove: function () {
        if (!this.points) {
            return
        }
        this.el.removeObject3D('mesh');
    }
    /*        this.geometry = new THREE.BufferGeometry();
    
            const pcd = GlobalPointCloud;
    
            let ll = pcd.length / 3;
    
            console.log("Length ll", ll)
            console.log("x,y,z", pcd[0], pcd[1], pcd[2])
            console.log("x,y,z", pcd[3], pcd[4], pcd[5])
            console.log("x,y,z", pcd[6], pcd[7], pcd[8])
    
            var positions = []
            for (let i = 0; i < pcd.length; i++) {
                positions.push(pcd[i])
            }
            //        this.geometry.vertices.push(new THREE.Vector3(0, 0, 0));
            this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            //        const material = new PointsMaterial({ size: 0.03 })
            this.material = new THREE.PointsMaterial({
                color: "#888",
                size: 0.5,
                sizeAttenuation: false
            });
    
            this.points = new THREE.Points(this.geometry, this.material);
            // Set mesh on entity.
            console.log("Check EL", this.el)
    
            if (this.el) {
                this.el.setObject3D('mesh', this.points);
            }
    
            //        geometry.computeBoundingBox();
            //        geometry.computeBoundingSphere();
    
            //        var mesh = new THREE.Points(geometry, material);
    
            //        geometry.computeVertexNormals();
            //        this.geometry = geometry;
            //        let el = this.el;
            //        console.log("This", this)
            //        el.setObject3D('mesh', mesh);
            //this.draw = this.el.components.draw;
            //this.draw.register(this.render.bind(this));
        },
        update: function () {
            console.log("Update")
            console.log("Check EL", this.el)
    
            if (this.el) {
                this.el.setObject3D('mesh', this.points);
            }
    
            this.render()
        },
        render: function () {
            console.log("Render!")
            var ctx = this.draw.ctx;
            ctx.fillStyle = this.data.color;
            ctx.fillRect(68, 68, 120, 120);
    
        }*/
});


AFRAME.registerSystem('arena-pointcloud', {
    schema: {
        mqttHost: { type: 'string', default: "interop2024.uclab.jp" },
    },

    init() {
        ARENA.events.addEventListener(ARENA_EVENTS.USER_PARAMS_LOADED, this.ready.bind(this));
    },

    async ready() {
        //        console.log("Pointcloud MQTT-worker ready!")//, this.schema, this.el)
        const { data } = this;
        const { el } = this;

        const { sceneEl } = el;

        this.arena = sceneEl.systems['arena-scene'];
        this.health = sceneEl.systems['arena-health-ui'];

        // set up MQTT params for worker
        this.mqttHostURI = `wss://interop2024.uclab.jp:8999/`;

        //       console.log("Await start!")
        this.PointCloudWorker = this.initWorker();
    },

    // ここでは、comlink は使わないことにする（複数の Worker で、なんかバグってる？）
    initWorker() {
        //        console.log("Init pointcloud worker")
        const pointCloudWorker = new Worker(new URL('./workers/pointcloud-worker.js', import.meta.url), { type: 'module' });
        //        console.log("PCW", pointCloudWorker)

        // MQTT データが取得できた
        pointCloudWorker.onmessage = (e) => {
            //            console.log(e)
            this.onPointCloudMessageArrived(e.data)
        }
        const { idTag } = this.arena;
        pointCloudWorker.postMessage(['start', idTag]) // use userID?
        return pointCloudWorker;
    },

    /**
     * @param {object} mqttClientOptions
     * @param {function} [onSuccessCallBack]
     * @param {string} [lwMsg]
     * @param {string} [lwTopic]
     */
    connect(mqttClientOptions, onSuccessCallBack = undefined) {
        this.PointCloudWorker.connect(mqttClientOptions, onSuccessCallBack, lwMsg, lwTopic);
    },

    /**
     * Internal callback to pass MQTT connection health to ARENAHealth.
     * @param {object} msg Message object like: {addError: 'mqttScene.connection'}
     */
    mqttHealthCheck(msg) {
        if (msg.removeError) this.health.removeError(msg.removeError);
        else if (msg.addError) this.health.addError(msg.addError);
    },

    /**
     * Publishes message to mqtt
     * @param {string} topic
     * @param {string|object} payload
     * @param {number} qos
     * @param {boolean} retained
     */
    async publish(topic, payload, qos = 0, retained = false, raw = false) {
        await this.PointCloudWorker.publish(topic, payload, qos, retained, raw);
    },

    /**
     * Send a message to internal receive handler
     * @param {object} jsonMessage
     */
    processMessage(jsonMessage) {
        this.onSceneMessageArrived({ payloadObj: jsonMessage });
    },

    /**
     * Returns mqttClient connection state
     * @return {boolean}
     */
    async isConnected() {
        const client = this.MQTTWorker.mqttClient;
        const isConnected = await client.isConnected();
        return isConnected;
    },

    /**
     * MessageArrived handler for pointcloud messages; handles pointcloud messages
     * This message is expected to be JSON
     * @param {object} message
     */
    onPointCloudMessageArrived(message) {
        const ll = message.length / 3
        //        console.log("Length:", message.length, ll)

        const pcd = message;

        /*
        let xmax, ymax, xmin, ymin, zmax, zmin;
        xmax = ymax = zmax = -100;
        xmin = ymin = zmin = 100;
        
        for (let i = 0; i < ll; i++) {
            x = pcd[i * 3]
            y = pcd[i * 3 + 1]
            z = pcd[i * 3 + 2]
            if (x > xmax) xmax = x;
            if (y > ymax) ymax = y;
            if (z > zmax) zmax = z;
            if (x < xmin) xmin = x;
            if (y < ymin) ymin = y;
            if (z < zmin) zmin = z;
        }
        console.log("xyz", xmin, xmax, "y:", ymin, ymax, "z:", zmin, zmax)
        */

        const el = document.getElementById('pcd');
        const geometry = new AFRAME.THREE.BufferGeometry();
        geometry.setAttribute('position', new AFRAME.THREE.Float32BufferAttribute(pcd, 3));
        const material = new AFRAME.THREE.PointsMaterial({ size: 0.02 })
        geometry.rotateY(-0.4)
        geometry.computeBoundingBox();

        el.points = new AFRAME.THREE.Points(geometry, material);
        el.setObject3D('mesh', el.points);



        //        let ll = pcd.length / 3;
        /*
                if (!entityEl.geometry)
                    entityEl.geometry = new THREE.BufferGeometry();
        
                /*
                        const vertices = new Float32Array([
                            -1.0, 0, 1.0, // v0
                            1.0, .0, 1.0, // v1
                            1.0, 2.0, 1.0, // v2
                
                            1.0, 1.0, 1.0, // v3
                            -1.0, 1.0, 1.0, // v4
                            -1.0, 0, 1.0  // v5
                        ]);
            
                //        console.log("EntityEL", entityEl)
                //        console.log("EntityGeo", entityEl.geometry)
        
                //        entityEl.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                //      const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        
        
                //        var positions = []
                //        for (let i = 0; i < pcd.length; i++) {
                //            positions.push(pcd[i])
                //        }
                //        this.geometry.vertices.push(new THREE.Vector3(0, 0, 0));
        
                entityEl.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                //        const material = new PointsMaterial({ size: 0.03 })
        
        
                entityEl.material = new THREE.PointsMaterial({
                    color: 0x888888,
                    size: 0.5,
                    sizeAttenuation: false
                });
                entityEl.geometry.computeBoundingSphere();
        
                entityEl.points = new THREE.Points(entityEl.geometry, entityEl.material);
                entityEl.setObject3D('mesh', entityEl.points);
        */
    },
    //    tick() {
    //        console.log("Arena Tick!")
    //    }
});
