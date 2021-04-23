/**
 * @fileoverview Handle messaging from MQTT
 *
 * Open source software under the terms in /LICENSE
 * Copyright (c) 2020, The CONIX Research Center. All rights reserved.
 * @date 2020
 */

/* global THREE, ARENA */

// 'use strict';
import * as Comlink from '../vendor/comlink/comlink.mjs';
import {ClientEvent, CreateUpdate, Delete} from './message-actions/';

/**
 * Main ARENA MQTT client
 */
export class ARENAMqtt {
    // eslint-disable-next-line require-jsdoc
    static async init() {
        const mqtt = new ARENAMqtt();
        await mqtt._initWorker();
        return mqtt;
    }

    constructor() {
        this.MQTTWorker = undefined;
        this.mqttClient = undefined;
    }

    async _initWorker() {
        const MQTTWorker = Comlink.wrap(new Worker('../workers/mqtt-worker.js'));
        const worker = await new MQTTWorker(
            {
                renderTopic: ARENA.renderTopic,
                mqttHostURI: ARENA.mqttHostURI,
                idTag: ARENA.idTag,
            },
            Comlink.proxy(ARENA.initScene),
            Comlink.proxy(this._onMessageArrived),
            Comlink.proxy(() => {
                if (ARENA.Jitsi) {
                    if (!ARENA.Jitsi.ready) {
                        ARENA.Jitsi = ARENA.Jitsi(ARENA.jitsiServer);
                        console.warn(`ARENA Jitsi restarting...`);
                    }
                }
            }),
        );
        console.log('MQTT Worker initialized');
        this.MQTTWorker = worker;
        this.mqttClient = worker.mqttClient;
    }

    /**
     * Internal MessageArrived handler; handles object create/delete/event/... messages
     * @param {Object} message
     * @param {String} jsonMessage
     */
    _onMessageArrived(message, jsonMessage) {
        let theMessage = {};

        if (message) {
            try {
                theMessage = JSON.parse(message.payloadString);
            } catch { }
        } else if (jsonMessage) {
            theMessage = jsonMessage;
        }

        if (!theMessage) {
            console.warn('Received empty message');
            return;
        }

        if (theMessage.object_id === undefined) {
            console.warn('Malformed message (no object_id):', JSON.stringify(message));
            return;
        }

        if (theMessage.action === undefined) {
            console.warn('Malformed message (no action field):', JSON.stringify(message));
            return;
        }

        // rename object_id to match internal handlers (and aframe)
        theMessage.id = theMessage.object_id;
        delete theMessage.object_id;

        switch (theMessage.action) { // clientEvent, create, delete, update
        case 'clientEvent':
            if (theMessage.data === undefined) {
                console.warn('Malformed message (no data field):', JSON.stringify(message));
                return;
            }
            ClientEvent.handle(theMessage);
            break;
        case 'create':
        case 'update':
            if (theMessage.data === undefined) {
                console.warn('Malformed message (no data field):', JSON.stringify(message));
                return;
            }
            CreateUpdate.handle(theMessage.action, theMessage);
            break;
        case 'delete':
            Delete.handle(theMessage);
            break;
        case 'getPersist':
        case 'returnPersist':
            break;
        default:
            console.warn('Malformed message (invalid action field):', JSON.stringify(message));
            break;
        }
    }

    /**
     * @param {object} mqttClientOptions
     * @param {string} lwMsg
     * @param {string} lwTopic
     */
    async connect(mqttClientOptions, lwMsg=undefined, lwTopic=undefined) {
        await this.MQTTWorker.connect(mqttClientOptions, lwMsg, lwTopic);
    }
    async publish(topic, payload, qos, retained) {
        await this.MQTTWorker.publish(topic, payload, qos, retained);
    }
    /**
     * Send a message to internal receive handler
     * @param {string} jsonMessage
     */
    processMessage(jsonMessage) {
        return this._onMessageArrived(undefined, jsonMessage);
    }
    async isConnected() {
        return await this.mqttClient.isConnected();
    }
};
