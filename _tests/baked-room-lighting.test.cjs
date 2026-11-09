const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = path.join(__dirname, '../js/baked-room-lighting.js');
const context = { URL, Map };
if (fs.existsSync(file)) vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
const create = (...args) => {
    assert.equal(typeof context.createBakedLightingController, 'function', 'baked controller is implemented');
    return context.createBakedLightingController(...args);
};
function fixture() {
    const originals = [{ id: 'glass' }, { id: 'opaque' }, { id: 'cutout' }];
    const names = ['glass', 'opaque', 'cutout'];
    const materials = names.map((name, i) => ({ name, alphaMode: name,
        pbrMetallicRoughness: { baseColorTexture: { texture: originals[i], setTexture(texture) { this.texture = texture; } } } }));
    const requests = [];
    const viewer = { isConnected: true, model: { materials }, createTexture(url) {
        return new Promise((resolve, reject) => requests.push({ url, resolve, reject }));
    } };
    const manifest = { textureType: 'bakedAppearance', default: 'day', materials: ['opaque', 'glass', 'cutout'],
        presets: { day: { texture: 'day.png' }, work: { texture: 'work.png' }, read: { texture: 'read.png' } } };
    const controller = create(viewer, manifest, 'https://example.org/blog/assets/v1/lighting.json');
    const values = () => materials.map(m => m.pbrMetallicRoughness.baseColorTexture.texture);
    const texture = { sampler: { setWrapS() {}, setWrapT() {}, setMagFilter() {}, setMinFilter() {} } };
    return { viewer, manifest, controller, requests, originals, values, texture };
}
test('updates all named materials, resolves asset paths, restores embedded day without downloading', async () => {
    const f = fixture();
    const pending = f.controller.select('work');
    assert.equal(f.requests[0].url, 'https://example.org/blog/assets/v1/work.png');
    f.requests[0].resolve(f.texture);
    assert.equal(await pending, true);
    assert.ok(f.values().every(t => t === f.texture));
    assert.equal(await f.controller.select('day'), true);
    assert.deepEqual(f.values(), f.originals);
    await f.controller.select('work');
    assert.equal(f.requests.length, 1);
    assert.deepEqual(f.viewer.model.materials.map(m => m.alphaMode), ['glass', 'opaque', 'cutout']);
});
test('last selection wins even if earlier downloads finish later', async () => {
    const f = fixture();
    const work = f.controller.select('work');
    const read = f.controller.select('read');
    await f.controller.select('day');
    f.requests[1].resolve(f.texture);
    f.requests[0].resolve(f.texture);
    assert.equal(await work, false);
    assert.equal(await read, false);
    assert.deepEqual(f.values(), f.originals);
});
test('failure preserves appearance and allows retry', async () => {
    const f = fixture();
    const pending = f.controller.select('work');
    f.requests[0].reject(new Error('offline'));
    await assert.rejects(pending, /offline/);
    assert.deepEqual(f.values(), f.originals);
    const retry = f.controller.select('work');
    f.requests[1].resolve(f.texture);
    assert.equal(await retry, true);
});
test('close invalidates pending loads and stale failures', async () => {
    const f = fixture();
    const pending = f.controller.select('read');
    f.controller.dispose();
    f.viewer.isConnected = false;
    f.requests[0].reject(new Error('offline'));
    assert.equal(await pending, false);
    assert.deepEqual(f.values(), f.originals);
    assert.equal(await f.controller.select('work'), false);
});
