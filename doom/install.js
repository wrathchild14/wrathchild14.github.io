// Installation is an optional browser capability, separate from game code.
const button = document.querySelector('[data-install]');
const status = document.querySelector('[data-offline-status]');
const help = document.querySelector('[data-install-help]');
const appMode = window.matchMedia('(display-mode: standalone)');
let installPrompt = null;

function setStatus(message) {
    if (status) status.textContent = message;
}

function updateButton(installed = appMode.matches) {
    if (!button) return;
    button.textContent = installed
        ? 'App installed'
        : installPrompt
          ? 'Install game ↓'
          : 'Install options ↓';
    button.disabled = installed;
}

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    updateButton();
});
window.addEventListener('appinstalled', () => {
    installPrompt = null;
    updateButton(true);
});
appMode.addEventListener('change', () => updateButton());

button?.addEventListener('click', async () => {
    if (!installPrompt) {
        if (help) {
            help.open = true;
            help.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        }
        return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        updateButton(choice.outcome === 'accepted');
    } catch {
        updateButton();
        if (help) help.open = true;
    }
});

function watchRegistration(registration) {
    if (registration.waiting) {
        setStatus('Update downloaded. Close all game windows and reopen to apply it.');
    }
    function observe(worker) {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                setStatus('Update downloaded. Close all game windows and reopen to apply it.');
            }
            if (worker.state === 'redundant') {
                setStatus('Offline download did not finish. Reconnect and reload to retry.');
            }
        });
    }
    observe(registration.installing);
    registration.addEventListener('updatefound', () => observe(registration.installing));
}

async function prepareOffline() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) {
        setStatus('Offline installation needs HTTPS or localhost in a supported browser.');
        return;
    }
    try {
        const workerURL = new URL('./sw.js', import.meta.url);
        setStatus('Preparing offline play… about 9 MB, including the soundtrack.');
        const registration = await navigator.serviceWorker.register(workerURL, {
            updateViaCache: 'none',
        });
        watchRegistration(registration);
        await navigator.serviceWorker.ready;
        if (!registration.waiting) {
            setStatus('Ready for offline play. Game and soundtrack saved on this device.');
        }
    } catch {
        setStatus('Offline storage is unavailable. You can still play online; reload to retry.');
    }
}

updateButton();
prepareOffline();
