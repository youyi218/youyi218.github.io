// Fixed baked appearances: keep each material's alpha mode and the viewer's camera.
function createBakedLightingController(viewer, manifest, manifestURL) {
    if (manifest.textureType !== 'bakedAppearance' || manifest.default !== 'day') {
        throw new Error('Unsupported baked lighting manifest');
    }
    const infos = manifest.materials.map(name => {
        const material = viewer.model.materials.find(material => material.name === name);
        const info = material?.pbrMetallicRoughness.baseColorTexture;
        if (!info?.texture) throw new Error(`Missing baked material: ${name}`);
        return info;
    });
    const cache = new Map([['day', Promise.resolve(infos.map(info => info.texture))]]);
    let revision = 0;
    let disposed = false;

    function getTextures(key) {
        const preset = manifest.presets[key];
        if (!preset) throw new Error(`Unknown lighting preset: ${key}`);
        if (!cache.has(key)) {
            const pending = viewer.createTexture(new URL(preset.texture, manifestURL).href)
                .then(texture => {
                    if (!texture) throw new Error('Texture could not be loaded');
                    texture.sampler.setWrapS(33071);
                    texture.sampler.setWrapT(33071);
                    texture.sampler.setMagFilter(9729);
                    texture.sampler.setMinFilter(9987);
                    return infos.map(() => texture);
                }).catch(error => {
                    cache.delete(key);
                    throw error;
                });
            cache.set(key, pending);
        }
        return cache.get(key);
    }

    return {
        async select(key) {
            if (disposed) return false;
            const request = ++revision;
            const current = () => !disposed && request === revision && viewer.isConnected;
            try {
                const textures = await getTextures(key);
                if (!current()) return false;
                infos.forEach((info, index) => info.setTexture(textures[index]));
                return true;
            } catch (error) {
                if (!current()) return false;
                throw error;
            }
        },
        dispose() {
            disposed = true;
            ++revision;
            cache.clear();
        }
    };
}
