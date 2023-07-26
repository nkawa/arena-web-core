/* global AFRAME */

const info = AFRAME.utils.debug('ARENA:delete:info');
const warn = AFRAME.utils.debug('ARENA:delete:warn');
const error = AFRAME.utils.debug('ARENA:delete:error');

/**
 * Delete object handler
 */
export default class Delete {
    /**
     * Delete handler
     * @param {object} message message to be parsed
     */
    static handle(message) {
        const { id } = message;
        if (id === undefined) {
            error('Malformed message (no object_id):', JSON.stringify(message));
        }

        const entityEl = document.getElementById(id);
        if (!entityEl) {
            error(`Object with object_id "${id}" does not exist!`);
            return;
        }

        // CLean up linked dependants
        document.querySelectorAll(`[dep=${id}]`).forEach((depEl) => {
            const depParentEl = depEl.parentEl;
            if (depParentEl) {
                depParentEl.removeChild(depEl);
            }
        });

        // Remove element itself
        const { parentEl } = entityEl;
        if (parentEl) {
            parentEl.removeChild(entityEl);
        }
    }
}