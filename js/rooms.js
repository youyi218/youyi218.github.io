(() => {
    let viewerModule;
    let active;

    function loadViewer() {
        if (!viewerModule) {
            viewerModule = import('https://ajax.googleapis.com/ajax/libs/model-viewer/4.4.0/model-viewer.min.js')
                .catch((error) => {
                    viewerModule = undefined;
                    throw error;
                });
        }
        return viewerModule;
    }

    function closeRoom(room, focus = false) {
        if (active !== room) return;
        active = undefined;
        room.abort?.abort();
        room.baked?.dispose();
        room.viewer?.remove();
        room.stage.classList.remove('room-ready');
        room.stage.removeAttribute('aria-busy');
        room.open.hidden = false;
        room.open.removeAttribute('aria-disabled');
        room.open.setAttribute('aria-expanded', 'false');
        room.label.textContent = '点击探索 3D 房间';
        room.close.hidden = true;
        room.lighting.hidden = true;
        room.panel.hidden = true;
        room.lighting.setAttribute('aria-expanded', 'false');
        room.status.textContent = '';
        if (focus) room.open.focus();
    }

    document.querySelectorAll('.room').forEach((element) => {
        const stage = element.querySelector('.room-stage');
        const open = element.querySelector('.room-open');
        const close = element.querySelector('.room-close');
        const status = element.querySelector('.room-status');
        const label = element.querySelector('.room-open-label');
        const lighting = element.querySelector('.room-lighting');
        const panel = element.querySelector('.room-light-panel');
        const bakedURL = stage.dataset.lighting;
        const preset = element.querySelector('.room-light-preset');
        const inputs = element.querySelectorAll('.room-light-input');
        const settings = { azimuth: -45, elevation: 50, temperature: 4500, intensity: .85 };
        let environmentKey;
        let environment;

        function applyLighting(viewer) {
            if (bakedURL) {
                viewer.setAttribute('tone-mapping', 'none');
                viewer.setAttribute('exposure', '1');
                viewer.setAttribute('shadow-intensity', '0');
                viewer.removeAttribute('environment-image');
                return;
            }
            const custom = preset.value === 'custom';
            const bright = preset.value === 'bright';
            viewer.setAttribute('exposure', custom ? String(settings.intensity) : bright ? '1' : '0.85');
            viewer.setAttribute('tone-mapping', bright ? 'neutral' : 'agx');
            viewer.setAttribute('shadow-intensity', bright ? '1' : '0.65');
            if (custom) {
                const key = [settings.azimuth, settings.elevation, settings.temperature].join(',');
                if (key !== environmentKey) {
                    environment = RoomLighting.environmentURL(settings);
                    environmentKey = key;
                }
                viewer.setAttribute('environment-image', environment);
            } else {
                viewer.removeAttribute('environment-image');
            }
        }

        lighting.addEventListener('click', () => {
            if (active?.stage !== stage || !active.viewer) return;
            panel.hidden = !panel.hidden;
            lighting.setAttribute('aria-expanded', String(!panel.hidden));
        });

        preset?.addEventListener('change', () => {
            if (preset.value !== 'custom') {
                settings.intensity = preset.value === 'bright' ? 1 : .85;
                const input = panel.querySelector('[data-setting="intensity"]');
                const value = `${Math.round(settings.intensity * 100)}%`;
                input.value = String(settings.intensity);
                input.setAttribute('aria-valuetext', value);
                input.closest('label').querySelector('output').textContent = value;
            }
            if (active?.stage === stage && active.viewer) applyLighting(active.viewer);
        });

        inputs.forEach(input => {
            function readSetting() {
                const name = input.dataset.setting;
                settings[name] = Number(input.value);
                const value = name === 'temperature' ? `${input.value} K` :
                    name === 'intensity' ? `${Math.round(settings[name] * 100)}%` : `${input.value}°`;
                const output = input.closest('label').querySelector('output');
                if (output) output.textContent = value;
                if (input.type === 'range') input.setAttribute('aria-valuetext', value);
                preset.value = 'custom';
            }
            input.addEventListener('input', readSetting);
            // Commit on release instead of rebuilding an HDR map on every drag frame.
            input.addEventListener('change', () => {
                readSetting();
                if (active?.stage === stage && active.viewer) applyLighting(active.viewer);
            });
        });

        close.addEventListener('click', () => {
            if (active?.stage === stage) closeRoom(active, true);
        });

        open.addEventListener('click', async () => {
            if (active?.stage === stage) return;
            if (active) closeRoom(active);
            // Each attempt has its own identity: a cancelled import must not reopen a room.
            const room = { stage, open, close, status, label, lighting, panel, abort: new AbortController() };
            active = room;
            open.setAttribute('aria-disabled', 'true');
            open.setAttribute('aria-expanded', 'true');
            stage.setAttribute('aria-busy', 'true');
            close.hidden = false;
            label.textContent = '正在加载 3D…';
            status.textContent = '正在加载房间，请稍候…';

            function fail() {
                if (active !== room) return;
                closeRoom(room);
                label.textContent = '加载失败，点击重试';
                status.textContent = '暂时无法打开 3D 房间，请重试或下载模型。';
            }

            try {
                const [, manifest] = await Promise.all([loadViewer(), bakedURL ?
                    fetch(bakedURL, { signal: room.abort.signal }).then(response => {
                        if (!response.ok) throw new Error('Lighting configuration could not be loaded');
                        return response.json();
                    }) : null]);
                const manifestURL = bakedURL ? new URL(bakedURL, document.baseURI).href : null;
                if (manifest && (manifest.textureType !== 'bakedAppearance' || manifest.default !== 'day' ||
                    manifest.uvSet !== 0 || manifest.colorSpace !== 'srgb' || manifest.toneMapping !== 'none' ||
                    manifest.exposure !== 1 || !manifest.presets?.day)) {
                    throw new Error('Unsupported baked lighting configuration');
                }
                if (active !== room) return;
                const viewer = document.createElement('model-viewer');
                room.viewer = viewer;
                viewer.tabIndex = 0;
                viewer.setAttribute('alt', `${stage.dataset.title}的三维模型`);
                viewer.setAttribute('camera-orbit', stage.dataset.cameraOrbit);
                viewer.setAttribute('camera-target', stage.dataset.cameraTarget);
                if (stage.dataset.minCameraOrbit) {
                    viewer.setAttribute('min-camera-orbit', stage.dataset.minCameraOrbit);
                }
                viewer.setAttribute('camera-controls', '');
                viewer.setAttribute('interaction-prompt', 'none');
                viewer.setAttribute('touch-action', 'pan-y');
                applyLighting(viewer);
                viewer.setAttribute('loading', 'eager');
                viewer.addEventListener('load', () => {
                    if (active !== room) return;
                    if (manifest) {
                        try {
                            room.baked = createBakedLightingController(viewer, manifest, manifestURL);
                            const group = panel.querySelector('.room-baked-presets');
                            group.replaceChildren();
                            group.removeAttribute('aria-busy');
                            let selection = 0;
                            for (const [key, option] of Object.entries(manifest.presets)) {
                                const button = document.createElement('button');
                                button.type = 'button';
                                button.textContent = option.label;
                                button.setAttribute('aria-pressed', String(key === manifest.default));
                                button.addEventListener('click', async () => {
                                    const request = ++selection;
                                    group.setAttribute('aria-busy', 'true');
                                    status.textContent = `正在加载${option.label}光照…`;
                                    try {
                                        const applied = await room.baked.select(key);
                                        if (active !== room || request !== selection || !applied) return;
                                        for (const other of group.children) {
                                            other.setAttribute('aria-pressed', String(other === button));
                                        }
                                        status.textContent = `已切换为${option.label}`;
                                    } catch (error) {
                                        if (active === room && request === selection) {
                                            status.textContent = `${option.label}光照加载失败，保留当前场景；点击该选项重试。`;
                                        }
                                    } finally {
                                        if (active === room && request === selection) group.removeAttribute('aria-busy');
                                    }
                                });
                                group.append(button);
                            }
                        } catch (error) {
                            fail();
                            return;
                        }
                    }
                    stage.classList.add('room-ready');
                    stage.removeAttribute('aria-busy');
                    const focusViewer = document.activeElement === open;
                    open.hidden = true;
                    lighting.hidden = false;
                    if (manifest) {
                        panel.hidden = false;
                        lighting.setAttribute('aria-expanded', 'true');
                    }
                    status.textContent = '';
                    if (focusViewer) viewer.focus();
                }, { once: true });
                viewer.addEventListener('error', fail, { once: true });
                viewer.setAttribute('src', manifest ? new URL(manifest.model, manifestURL).href : stage.dataset.model);
                stage.append(viewer);
            } catch (error) {
                fail();
            }
        });
    });
})();
