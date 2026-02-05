/**
 * Toast Notification System
 * Usage:
 * Toast.show({ message: 'Success!', variant: 'success', duration: 3000 })
 * Toast.success('Operation completed!')
 * Toast.error('Something went wrong!')
 * Toast.warning('Please be careful!')
 * Toast.info('Here is some information')
 */

const Toast = (function () {
    let toastCounter = 0;

    const defaultOptions = {
        message: '',
        title: '',
        variant: 'info', // primary, secondary, success, danger, warning, info, light, dark
        duration: 5000, // milliseconds, 0 for no auto-hide
        icon: '', // optional icon class
        position: 'top-end', // top-start, top-center, top-end, bottom-start, bottom-center, bottom-end
        dismissible: true,
        animation: true
    };

    const variantIcons = {
        success: 'bi bi-check-circle-fill',
        error: 'bi bi-x-circle-fill',
        danger: 'bi bi-x-circle-fill',
        warning: 'bi bi-exclamation-triangle-fill',
        info: 'bi bi-info-circle-fill',
        primary: 'bi bi-star-fill',
        secondary: 'bi bi-bell-fill'
    };

    function getContainer(position) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = `toast-container position-fixed ${position} p-3`;
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        } else {
            // Update position if different
            container.className = `toast-container position-fixed ${position} p-3`;
        }
        return container;
    }

    function createToast(options) {
        const opts = { ...defaultOptions, ...options };
        const toastId = `toast-${++toastCounter}`;
        const icon = opts.icon || variantIcons[opts.variant] || '';

        const toastHtml = `
            <div id="${toastId}" class="toast ${opts.animation ? 'fade' : ''}" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header bg-${opts.variant} text-white">
                    ${icon ? `<i class="${icon} me-2"></i>` : ''}
                    <strong class="me-auto">${opts.title || capitalizeFirst(opts.variant)}</strong>
                    <small class="text-white-50">just now</small>
                    ${opts.dismissible ? '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>' : ''}
                </div>
                <div class="toast-body">
                    ${opts.message}
                </div>
            </div>
        `;

        const container = getContainer(opts.position);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = toastHtml.trim();
        const toastElement = tempDiv.firstChild;
        
        container.appendChild(toastElement);

        // Initialize Bootstrap toast
        const bsToast = new bootstrap.Toast(toastElement, {
            autohide: opts.duration > 0,
            delay: opts.duration
        });

        // Show the toast
        bsToast.show();

        // Remove from DOM after hidden
        toastElement.addEventListener('hidden.bs.toast', function () {
            toastElement.remove();
        });

        return {
            element: toastElement,
            toast: bsToast,
            hide: () => bsToast.hide()
        };
    }

    function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Public API
    return {
        show: function (options) {
            return createToast(options);
        },
        success: function (message, title = '') {
            return createToast({ message, title, variant: 'success' });
        },
        error: function (message, title = '') {
            return createToast({ message, title, variant: 'danger' });
        },
        warning: function (message, title = '') {
            return createToast({ message, title, variant: 'warning' });
        },
        info: function (message, title = '') {
            return createToast({ message, title, variant: 'info' });
        },
        primary: function (message, title = '') {
            return createToast({ message, title, variant: 'primary' });
        }
    };
})();

// Make Toast available globally
window.Toast = Toast;
