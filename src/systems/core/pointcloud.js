/**
 * @fileoverview Handle PointCloud from MQTT
 *
 * @date 2024/06/12
 */

// 'use strict';

import { proxy, wrap } from 'comlink'; // for worker - main communcation

import { ARENA_EVENTS, ACTIONS } from '../../constants';

import { PointsMaterial } from 'three';

var GlobalPointCloud = null;

/* PointCloud のためのジオメトリ */
AFRAME.registerGeometry('pointcloud', {
    schema: {
        vertices: {
            default: ['-10 10 0', '-10 -10 0', '10 -10 0'],
        }
    },

    init: function (data) {
        console.log("PointCould data")
        var geometry = new THREE.BufferGeometry();
        const pcd = GlobalPointCloud;
        //        console.log("PCD", pcd)

        let ll = pcd.length / 3;

        console.log("Length ll", ll)
        //        pointsArray = new Array()

        //        for (let i = 0; i < ll; i++) {
        //            pointsArray.push(new THREE.Vector3(pcd[i * 3 + 0], points[i * 3 + 2], points[i * 3 + 1]));
        //        }
        //console.log("Add", geometry)
        //        console.log("Addatt", geometry.addAttribute)
        //        geometry.setAttribute('position', new THREE.Float32BufferAttribute(pcd, 3));

        var positions = []
        for (let i = 0; i < pcd.length; i++) {
            positions.push(pcd[i])
        }


        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        //        geometry.setFromPoints(ARENA.pointcloud);
        //        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        const material = new PointsMaterial({ size: 0.03 })
        var mesh = new THREE.Points(geometry, material);

        //        geometry.computeVertexNormals();
        this.geometry = geometry;
        //        let el = this.el;
        //        console.log("Check EL", el)
        //        el.setObject3D('mesh', mesh);
        //        this.draw = this.el.components.draw;
        //        this.draw.register(this.render.bind(this));
    },
    update: function () {
        console.log("Update")
        this.render()
    },
    render: function () {
        console.log("Render!")
        var ctx = this.draw.ctx;
        ctx.fillStyle = this.data.color;
        ctx.fillRect(68, 68, 120, 120);

    }
});


AFRAME.registerSystem('arena-pointcloud', {
    schema: {
        mqttHost: { type: 'string', default: "interop2024.uclab.jp" },
        mqttPath: { type: 'array', default: ["pointcloud"] },
    },

    init() {
        ARENA.events.addEventListener(ARENA_EVENTS.USER_PARAMS_LOADED, this.ready.bind(this));
    },

    async ready() {
        console.log("Pointcloud MQTT-worker ready!", this.schema, this.el)
        const { data } = this;
        const { el } = this;

        const { sceneEl } = el;

        this.arena = sceneEl.systems['arena-scene'];
        this.health = sceneEl.systems['arena-health-ui'];

        // set up MQTT params for worker
        this.userName = this.arena.mqttToken.mqtt_username;
        this.mqttHost = "interop2024.uclab.jp"; // static!
        this.mqttPath = "livox"
        this.mqttHostURI = `wss://interop2024.uclab.jp:8999/`;

        //       console.log("Await start!")
        this.PointCloudWorker = await this.initWorker();

        //        console.log("PointCloudWorker Initialized", this.PointCloudWorker)

        const mqttToken = this.arena.mqttToken.mqtt_token;
        const { camName } = this.arena;
        const { outputTopic } = this.arena;
        // Do not pass functions in mqttClientOptions
        ARENA.Mqtt = this; // Restore old alias
        this.connect(
            {
                reconnect: true,
                userName: this.userName,
                password: mqttToken,
            },
            proxy(() => {
                console.log('ARENA MQTT PointCloud connection success!');
                //                ARENA.events.emit(ARENA_EVENTS.MQTT_LOADED, true); //only one should do this!
            }),
            // last will message
            JSON.stringify({ object_id: camName, action: 'delete' }),
            // last will topic
            outputTopic + camName
        );
    },

    async initWorker() {
        const { renderTopic } = this.arena;
        const { idTag } = this.arena;
        console.log("Init pointcloud worker")

        const PointCloudWorker = wrap(new Worker(new URL('./workers/pointcloud-worker.js', import.meta.url), { type: 'module' }));
        console.log("PCW", PointCloudWorker)
        const worker = await new PointCloudWorker(
            {
                renderTopic,
                mqttHostURI: this.mqttHostURI,
                idTag,
            },
            proxy(this.mqttHealthCheck.bind(this))

        );
        //        console.log("PCW Worker!", worker)
        worker.registerMessageHandler('p', proxy(this.onPointCloudMessageArrived.bind(this)), false);
        //        console.log("Return PCW Worker!", worker)
        return worker;
    },

    /**
     * @param {object} mqttClientOptions
     * @param {function} [onSuccessCallBack]
     * @param {string} [lwMsg]
     * @param {string} [lwTopic]
     */
    connect(mqttClientOptions, onSuccessCallBack = undefined, lwMsg = undefined, lwTopic = undefined) {
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
        //        const theMessage = message.payloadObj; // This will be given as json

        //        console.log("mes Arrived", message.length)


        const buildWatchScene = document.querySelector('a-scene').getAttribute('build3d-mqtt-scene');
        let entityEl = document.getElementById('pcd');
        if (!entityEl) {
            entityEl = document.createElement('a-entity');
            entityEl.object3D.renderOrder = 1;
            entityEl.setAttribute('id', 'pcd');
            //            addObj = true;
            const sceneRoot = document.getElementById('sceneRoot');
            sceneRoot.appendChild(entityEl);

        }

        //        entityEl.setAttribute('geometry', 'primitive', 'box');

        //      entityEl.setAttribute('geometry', 'primitive', 'box');
        let fb = "";
        const ll = message.length / 3
        console.log("Length:", ll, message.length)
        //       for (let k = 0; k > ll; k++) {
        //            fb += message[k * 3].toFixed(3) + ""
        //        }
        GlobalPointCloud = message; // いきなりグローバルに設定しちゃえ！

        entityEl.setAttribute('geometry', "primitive: pointcloud;");


        //        console.log("Set Attribute", GlobalPointCloud)
        //        geometry.addAttribute('position', new THREE.BufferAttribute(position, 3));



        /*        if (!theMessage) {
                    warn('Received empty message');
                    return;
                }
        
                if (theMessage.object_id === undefined) {
                    warn('Malformed message (no object_id):', JSON.stringify(message));
                    return;
                }
        
                if (theMessage.action === undefined) {
                    warn('Malformed message (no action field):', JSON.stringify(message));
                    return;
                }
        
                // rename object_id to match internal handlers (and aframe)
                theMessage.id = theMessage.object_id;
                delete theMessage.object_id;
        
                let topicUser;
                if (message.destinationName) {
                    // This is a Paho.MQTT.Message
                    // [realm, category, namespace, scene, user]
                    [, , , , topicUser] = message.destinationName.split('/');
                }
        
                switch (
                theMessage.action // clientEvent, create, delete, update
                ) {
                    case ACTIONS.CLIENT_EVENT:
                        if (theMessage.data === undefined) {
                            warn('Malformed message (no data field):', JSON.stringify(message));
                            return;
                        }
                        // check topic
                        if (message.destinationName) {
                            if (topicUser !== theMessage.data.source) {
                                warn(
                                    'Malformed message (topic does not pass check):',
                                    JSON.stringify(message),
                                    message.destinationName
                                );
                                return;
                            }
                        }
                        ClientEvent.handle(theMessage);
                        break;
                    case ACTIONS.CREATE:
                    case ACTIONS.UPDATE:
                        if (theMessage.data === undefined) {
                            warn('Malformed message (no data field):', JSON.stringify(message));
                            return;
                        }
                        // check topic
                        if (message.destinationName) {
                            if (!message.destinationName.endsWith(`/${theMessage.id}`)) {
                                warn(
                                    'Malformed message (topic does not pass check):',
                                    JSON.stringify(message),
                                    message.destinationName
                                );
                                return;
                            }
                        }
                        CreateUpdate.handle(theMessage.action, theMessage);
                        break;
                    case ACTIONS.DELETE:
                        // check topic
                        if (message.destinationName) {
                            if (!message.destinationName.endsWith(`/${theMessage.id}`)) {
                                warn(
                                    'Malformed message (topic does not pass check):',
                                    JSON.stringify(message),
                                    message.destinationName
                                );
                                return;
                            }
                        }
                        Delete.handle(theMessage);
                        break;
                    case ACTIONS.GET_PERSIST:
                    case ACTIONS.RETURN_PERSIST:
                        break;
                    default:
                        warn('Malformed message (invalid action field):', JSON.stringify(message));
                        break;
                }
            },
            */

    }
});
