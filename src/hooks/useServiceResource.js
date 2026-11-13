import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { isPlainObject } from '../utils/validators';

export const SERVICE_RESOURCE_STATUSES = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  EMPTY: 'empty',
  ERROR: 'error',
});

const INTERNAL_ERROR_CODE = 'INTERNAL_MOCK_ERROR';
const INTERNAL_ERROR_MESSAGE =
  'The demonstration operation could not be completed.';

/**
 * Creates a safe, stable service error projection.
 *
 * @param {unknown} error
 * @returns {{
 *   status: 'error',
 *   errorCode: string,
 *   errorMessage: string,
 *   retryable: boolean
 * }}
 */
export function normalizeServiceResourceError(error) {
  const candidate = isPlainObject(error) ? error : {};

  const errorCode =
    typeof candidate.errorCode === 'string' &&
    candidate.errorCode.trim().length > 0
      ? candidate.errorCode.trim()
      : typeof candidate.code === 'string' &&
          candidate.code.trim().length > 0
        ? candidate.code.trim()
        : INTERNAL_ERROR_CODE;
  const errorMessage =
    typeof candidate.errorMessage === 'string' &&
    candidate.errorMessage.trim().length > 0
      ? candidate.errorMessage.trim()
      : typeof candidate.message === 'string' &&
          candidate.message.trim().length > 0
        ? candidate.message.trim()
        : INTERNAL_ERROR_MESSAGE;

  return {
    status: 'error',
    errorCode,
    errorMessage,
    retryable: candidate.retryable === true,
  };
}

/**
 * Determines whether a resource value should be represented as empty.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEmptyServiceResource(value) {
  return (
    value === null ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * Determines whether dependency values changed using Object.is semantics.
 *
 * @param {Array<unknown>} previous
 * @param {Array<unknown>} next
 * @returns {boolean}
 */
function dependenciesChanged(previous, next) {
  return (
    previous.length !== next.length ||
    previous.some(
      (dependency, index) =>
        !Object.is(dependency, next[index]),
    )
  );
}

/**
 * Normalizes supported hook options.
 *
 * An array is accepted as shorthand for the dependencies option.
 *
 * @param {unknown} options
 * @returns {Record<string, unknown>}
 */
function normalizeOptions(options) {
  if (Array.isArray(options)) {
    return {
      dependencies: options,
    };
  }

  if (options === undefined) {
    return {};
  }

  if (!isPlainObject(options)) {
    throw new TypeError(
      'Service resource options must be an object or dependency array.',
    );
  }

  return options;
}

/**
 * Resolves a local service result into success data or a deterministic error.
 *
 * @param {unknown} response
 * @returns {{
 *   successful: boolean,
 *   data?: unknown,
 *   error?: {
 *     status: 'error',
 *     errorCode: string,
 *     errorMessage: string,
 *     retryable: boolean
 *   }
 * }}
 */
function resolveServiceResponse(response) {
  if (
    isPlainObject(response) &&
    Object.prototype.hasOwnProperty.call(response, 'status')
  ) {
    if (response.status === 'success') {
      return {
        successful: true,
        data: response.data,
      };
    }

    if (response.status === 'error') {
      return {
        successful: false,
        error: normalizeServiceResourceError(response),
      };
    }

    return {
      successful: false,
      error: normalizeServiceResourceError(null),
    };
  }

  return {
    successful: true,
    data: response,
  };
}

/**
 * Creates the initial resource state.
 *
 * @param {unknown} initialData
 * @param {boolean} enabled
 * @param {(value: unknown) => boolean} emptyPredicate
 * @returns {Record<string, unknown>}
 */
function createInitialState(
  initialData,
  enabled,
  emptyPredicate,
) {
  if (enabled) {
    return {
      status: SERVICE_RESOURCE_STATUSES.LOADING,
      data: initialData,
      error: null,
      loading: true,
    };
  }

  return {
    status: emptyPredicate(initialData)
      ? SERVICE_RESOURCE_STATUSES.EMPTY
      : SERVICE_RESOURCE_STATUSES.IDLE,
    data: initialData,
    error: null,
    loading: false,
  };
}

/**
 * Loads a browser-local service resource with stale-request and abort safety.
 *
 * Service loaders may return a value, a promise, or a standard
 * `{status, data|errorCode}` service response. The loader receives a request
 * context containing an AbortSignal. Reset revision changes, dependency
 * changes, and explicit retries trigger a new request.
 *
 * @param {(context: {
 *   signal: AbortSignal,
 *   attempt: number,
 *   resetRevision: unknown
 * }) => unknown|Promise<unknown>} loader
 * @param {{
 *   initialData?: unknown,
 *   enabled?: boolean,
 *   resetRevision?: unknown,
 *   dependencies?: Array<unknown>,
 *   isEmpty?: (value: unknown) => boolean,
 *   select?: (value: unknown) => unknown,
 *   transform?: (value: unknown) => unknown,
 *   preserveDataOnReload?: boolean
 * }|Array<unknown>} [options]
 * @returns {{
 *   status: string,
 *   data: unknown,
 *   error: Record<string, unknown>|null,
 *   loading: boolean,
 *   isLoading: boolean,
 *   isSuccess: boolean,
 *   isEmpty: boolean,
 *   isError: boolean,
 *   isIdle: boolean,
 *   retry: () => void,
 *   reload: () => void,
 *   refresh: () => void
 * }}
 */
export function useServiceResource(loader, options = {}) {
  if (typeof loader !== 'function') {
    throw new TypeError(
      'Service resource loader must be a function.',
    );
  }

  const configuration = normalizeOptions(options);
  const enabled = configuration.enabled ?? true;
  const dependencies = configuration.dependencies ?? [];
  const emptyPredicate =
    configuration.isEmpty ?? isEmptyServiceResource;
  const selector =
    configuration.select ?? configuration.transform ?? null;
  const preserveDataOnReload =
    configuration.preserveDataOnReload === true;
  const initialData = configuration.initialData ?? null;
  const resetRevision = configuration.resetRevision;

  if (typeof enabled !== 'boolean') {
    throw new TypeError(
      'Service resource enabled state must be a boolean.',
    );
  }

  if (!Array.isArray(dependencies)) {
    throw new TypeError(
      'Service resource dependencies must be an array.',
    );
  }

  if (typeof emptyPredicate !== 'function') {
    throw new TypeError(
      'Service resource empty predicate must be a function.',
    );
  }

  if (selector !== null && typeof selector !== 'function') {
    throw new TypeError(
      'Service resource selector must be a function.',
    );
  }

  const loaderRef = useRef(loader);
  const configurationRef = useRef(null);
  const dependenciesRef = useRef([...dependencies]);
  const dependencyRevisionRef = useRef(0);
  const requestSequenceRef = useRef(0);

  loaderRef.current = loader;
  configurationRef.current = {
    emptyPredicate,
    initialData,
    preserveDataOnReload,
    resetRevision,
    selector,
  };

  if (
    dependenciesChanged(
      dependenciesRef.current,
      dependencies,
    )
  ) {
    dependenciesRef.current = [...dependencies];
    dependencyRevisionRef.current += 1;
  }

  const dependencyRevision = dependencyRevisionRef.current;
  const [requestRevision, retryRequest] = useReducer(
    (revision) => revision + 1,
    0,
  );
  const [state, setState] = useState(() =>
    createInitialState(
      initialData,
      enabled,
      emptyPredicate,
    ),
  );

  const retry = useCallback(() => {
    retryRequest();
  }, []);

  useEffect(() => {
    if (!enabled) {
      const currentConfiguration =
        configurationRef.current;

      setState({
        status: currentConfiguration.emptyPredicate(
          currentConfiguration.initialData,
        )
          ? SERVICE_RESOURCE_STATUSES.EMPTY
          : SERVICE_RESOURCE_STATUSES.IDLE,
        data: currentConfiguration.initialData,
        error: null,
        loading: false,
      });

      return undefined;
    }

    const controller = new AbortController();
    const requestSequence = requestSequenceRef.current + 1;
    const currentConfiguration = configurationRef.current;

    requestSequenceRef.current = requestSequence;

    setState((currentState) => ({
      status: SERVICE_RESOURCE_STATUSES.LOADING,
      data: currentConfiguration.preserveDataOnReload
        ? currentState.data
        : currentConfiguration.initialData,
      error: null,
      loading: true,
    }));

    const loadResource = async () => {
      try {
        const response = await Promise.resolve(
          loaderRef.current({
            signal: controller.signal,
            attempt: requestSequence,
            resetRevision:
              currentConfiguration.resetRevision,
          }),
        );

        if (
          controller.signal.aborted ||
          requestSequence !== requestSequenceRef.current
        ) {
          return;
        }

        const resolvedResponse =
          resolveServiceResponse(response);

        if (!resolvedResponse.successful) {
          setState({
            status: SERVICE_RESOURCE_STATUSES.ERROR,
            data: currentConfiguration.initialData,
            error: resolvedResponse.error,
            loading: false,
          });
          return;
        }

        const selectedData =
          currentConfiguration.selector === null
            ? resolvedResponse.data
            : currentConfiguration.selector(
                resolvedResponse.data,
              );
        const empty =
          currentConfiguration.emptyPredicate(selectedData);

        setState({
          status: empty
            ? SERVICE_RESOURCE_STATUSES.EMPTY
            : SERVICE_RESOURCE_STATUSES.SUCCESS,
          data: selectedData,
          error: null,
          loading: false,
        });
      } catch (error) {
        if (
          controller.signal.aborted ||
          requestSequence !== requestSequenceRef.current
        ) {
          return;
        }

        setState({
          status: SERVICE_RESOURCE_STATUSES.ERROR,
          data: currentConfiguration.initialData,
          error: normalizeServiceResourceError(error),
          loading: false,
        });
      }
    };

    loadResource();

    return () => {
      controller.abort();
    };
  }, [
    dependencyRevision,
    enabled,
    requestRevision,
    resetRevision,
  ]);

  return useMemo(
    () => ({
      status: state.status,
      data: state.data,
      error: state.error,
      loading: state.loading,
      isLoading:
        state.status === SERVICE_RESOURCE_STATUSES.LOADING,
      isSuccess:
        state.status === SERVICE_RESOURCE_STATUSES.SUCCESS,
      isEmpty:
        state.status === SERVICE_RESOURCE_STATUSES.EMPTY,
      isError:
        state.status === SERVICE_RESOURCE_STATUSES.ERROR,
      isIdle:
        state.status === SERVICE_RESOURCE_STATUSES.IDLE,
      retry,
      reload: retry,
      refresh: retry,
    }),
    [
      retry,
      state.data,
      state.error,
      state.loading,
      state.status,
    ],
  );
}

export default useServiceResource;