import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  'audio[controls]',
  'video[controls]',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Determines whether a value can receive focus.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isFocusableElement(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.focus === 'function'
  );
}

/**
 * Determines whether an element is unavailable to keyboard users.
 *
 * @param {Element} element
 * @returns {boolean}
 */
function isUnavailableElement(element) {
  return (
    element.hasAttribute('disabled') ||
    element.getAttribute('aria-disabled') === 'true' ||
    element.hidden ||
    element.closest('[hidden], [inert], [aria-hidden="true"]') !==
      null
  );
}

/**
 * Returns the enabled focusable descendants of a container.
 *
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      isFocusableElement(element) &&
      !isUnavailableElement(element),
  );
}

/**
 * Resolves an element, ref, selector, or element provider.
 *
 * @param {unknown} target
 * @param {HTMLElement} container
 * @returns {HTMLElement|null}
 */
function resolveFocusTarget(target, container) {
  let candidate = target;

  if (typeof candidate === 'function') {
    candidate = candidate();
  }

  if (
    candidate !== null &&
    typeof candidate === 'object' &&
    Object.prototype.hasOwnProperty.call(candidate, 'current')
  ) {
    candidate = candidate.current;
  }

  if (typeof candidate === 'string') {
    try {
      candidate = container.querySelector(candidate);
    } catch {
      return null;
    }
  }

  return isFocusableElement(candidate) ? candidate : null;
}

/**
 * Focuses an element without requiring support for focus options.
 *
 * @param {unknown} element
 * @returns {boolean}
 */
function focusElement(element) {
  if (!isFocusableElement(element)) {
    return false;
  }

  try {
    element.focus({
      preventScroll: true,
    });
  } catch {
    try {
      element.focus();
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Traps keyboard focus within an active dialog-like container.
 *
 * The hook accepts either an options object or the positional
 * `(active, onEscape)` form. The returned ref should be assigned to the
 * dialog container unless a `containerRef` option is supplied.
 *
 * @param {{
 *   active?: boolean,
 *   isActive?: boolean,
 *   enabled?: boolean,
 *   onEscape?: (event: KeyboardEvent) => void,
 *   onClose?: (event: KeyboardEvent) => void,
 *   initialFocusRef?: {current: HTMLElement|null},
 *   initialFocus?: HTMLElement|string|(() => HTMLElement|null),
 *   triggerRef?: {current: HTMLElement|null},
 *   returnFocusRef?: {current: HTMLElement|null},
 *   restoreFocus?: boolean,
 *   containerRef?: {current: HTMLElement|null}
 * }|boolean} [options]
 * @param {(event: KeyboardEvent) => void} [escapeHandler]
 * @returns {{current: HTMLElement|null}}
 */
export function useFocusTrap(options = {}, escapeHandler) {
  const internalContainerRef = useRef(null);
  const latestOptionsRef = useRef(null);

  const configuration =
    typeof options === 'boolean'
      ? {
          active: options,
          onEscape: escapeHandler,
        }
      : options ?? {};

  const containerRef =
    configuration.containerRef !== null &&
    typeof configuration.containerRef === 'object' &&
    Object.prototype.hasOwnProperty.call(
      configuration.containerRef,
      'current',
    )
      ? configuration.containerRef
      : internalContainerRef;
  const active =
    configuration.active ??
    configuration.isActive ??
    configuration.enabled ??
    true;
  const restoreFocus = configuration.restoreFocus !== false;

  latestOptionsRef.current = configuration;

  useEffect(() => {
    if (!active) {
      return undefined;
    }

    const container = containerRef.current;

    if (
      container === null ||
      typeof container !== 'object' ||
      typeof container.querySelectorAll !== 'function'
    ) {
      return undefined;
    }

    const ownerDocument = container.ownerDocument;

    if (
      ownerDocument === null ||
      typeof ownerDocument.addEventListener !== 'function'
    ) {
      return undefined;
    }

    const configurationAtActivation =
      latestOptionsRef.current ?? {};
    const explicitReturnTarget =
      configurationAtActivation.returnFocusRef ??
      configurationAtActivation.triggerRef ??
      null;
    const triggeringElement =
      resolveFocusTarget(
        explicitReturnTarget,
        container,
      ) ??
      (isFocusableElement(ownerDocument.activeElement)
        ? ownerDocument.activeElement
        : null);
    const hadTabIndex = container.hasAttribute('tabindex');
    let temporaryTabIndex = false;

    const focusFirstAvailableElement = () => {
      const currentOptions = latestOptionsRef.current ?? {};
      const initialTarget = resolveFocusTarget(
        currentOptions.initialFocusRef ??
          currentOptions.initialFocus,
        container,
      );

      if (
        initialTarget !== null &&
        container.contains(initialTarget) &&
        !isUnavailableElement(initialTarget)
      ) {
        return focusElement(initialTarget);
      }

      const firstFocusable = getFocusableElements(container)[0];

      if (firstFocusable !== undefined) {
        return focusElement(firstFocusable);
      }

      if (!hadTabIndex && !container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
        temporaryTabIndex = true;
      }

      return focusElement(container);
    };

    const handleKeyDown = (event) => {
      if (!containerRef.current || event.defaultPrevented) {
        return;
      }

      if (event.key === 'Escape' || event.key === 'Esc') {
        const currentOptions = latestOptionsRef.current ?? {};
        const onEscape =
          currentOptions.onEscape ?? currentOptions.onClose;

        if (typeof onEscape === 'function') {
          event.preventDefault();
          event.stopPropagation();
          onEscape(event);
        }

        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements =
        getFocusableElements(container);
      const firstFocusable = focusableElements[0];
      const lastFocusable =
        focusableElements[focusableElements.length - 1];
      const activeElement = ownerDocument.activeElement;

      if (
        firstFocusable === undefined ||
        lastFocusable === undefined
      ) {
        event.preventDefault();
        focusFirstAvailableElement();
        return;
      }

      if (
        event.shiftKey &&
        (activeElement === firstFocusable ||
          !container.contains(activeElement))
      ) {
        event.preventDefault();
        focusElement(lastFocusable);
        return;
      }

      if (
        !event.shiftKey &&
        (activeElement === lastFocusable ||
          !container.contains(activeElement))
      ) {
        event.preventDefault();
        focusElement(firstFocusable);
      }
    };

    const handleFocusIn = (event) => {
      if (
        event.target !== null &&
        !container.contains(event.target)
      ) {
        focusFirstAvailableElement();
      }
    };

    ownerDocument.addEventListener(
      'keydown',
      handleKeyDown,
      true,
    );
    ownerDocument.addEventListener(
      'focusin',
      handleFocusIn,
      true,
    );

    focusFirstAvailableElement();

    return () => {
      ownerDocument.removeEventListener(
        'keydown',
        handleKeyDown,
        true,
      );
      ownerDocument.removeEventListener(
        'focusin',
        handleFocusIn,
        true,
      );

      if (temporaryTabIndex) {
        container.removeAttribute('tabindex');
      }

      if (!restoreFocus) {
        return;
      }

      const latestOptions = latestOptionsRef.current ?? {};
      const returnTarget =
        resolveFocusTarget(
          latestOptions.returnFocusRef ??
            latestOptions.triggerRef,
          container,
        ) ?? triggeringElement;

      if (
        returnTarget !== null &&
        returnTarget !== ownerDocument.body &&
        returnTarget.isConnected !== false
      ) {
        focusElement(returnTarget);
      }
    };
  }, [active, containerRef, restoreFocus]);

  return containerRef;
}

export default useFocusTrap;