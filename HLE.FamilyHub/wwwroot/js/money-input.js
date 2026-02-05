/**
 * Money Input Formatting
 *
 * Formats currency inputs with commas and decimals (e.g., "900,000.00")
 * Automatically strips formatting for form submission
 *
 * Usage: Add class "money-input" to any currency input field
 * <input type="text" class="form-control money-input" name="Amount" />
 */

(function () {
    'use strict';

    // Format a number with commas and 2 decimal places
    function formatMoney(value) {
        // Remove any existing formatting
        var num = parseFloat(value.toString().replace(/[^0-9.-]/g, ''));

        if (isNaN(num)) {
            return '';
        }

        // Format with commas and 2 decimal places
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // Parse formatted value back to number
    function parseMoney(value) {
        if (!value) return '';
        return value.toString().replace(/[^0-9.-]/g, '');
    }

    // Initialize money inputs on page load
    function initMoneyInputs() {
        var inputs = document.querySelectorAll('.money-input');

        inputs.forEach(function (input) {
            // Format initial value if present
            if (input.value) {
                var num = parseFloat(input.value);
                if (!isNaN(num)) {
                    input.value = formatMoney(num);
                }
            }

            // Create hidden input for form submission
            var hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = input.name;
            input.name = input.name + '_display';
            input.parentNode.insertBefore(hiddenInput, input.nextSibling);

            // Update hidden input with raw value
            function updateHiddenInput() {
                hiddenInput.value = parseMoney(input.value);
            }

            // Format on blur
            input.addEventListener('blur', function () {
                if (this.value) {
                    var rawValue = parseMoney(this.value);
                    if (rawValue) {
                        this.value = formatMoney(rawValue);
                    }
                }
                updateHiddenInput();
            });

            // Allow typing and handle input
            input.addEventListener('input', function () {
                updateHiddenInput();
            });

            // Select all on focus for easy replacement
            input.addEventListener('focus', function () {
                this.select();
            });

            // Handle paste
            input.addEventListener('paste', function (e) {
                var self = this;
                setTimeout(function () {
                    var rawValue = parseMoney(self.value);
                    if (rawValue) {
                        self.value = formatMoney(rawValue);
                    }
                    updateHiddenInput();
                }, 0);
            });

            // Initialize hidden input value
            updateHiddenInput();
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMoneyInputs);
    } else {
        initMoneyInputs();
    }

    // Expose for dynamic content
    window.initMoneyInputs = initMoneyInputs;
})();
