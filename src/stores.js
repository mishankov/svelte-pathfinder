import { writable, get } from 'svelte/store';

import {
	stringifyQuery,
	prependPrefix,
	injectParams,
	parseParams,
	parseQuery,
	shallowCopy,
	trimPrefix,
} from './utils';

export const pathable = createParsableStore(($path = '') => {
	if (typeof $path === 'string') $path = trimPrefix($path, '/').split('/');
	return !Object.prototype.hasOwnProperty.call($path, 'toString')
		? Object.defineProperty($path, 'toString', {
				value() {
					return prependPrefix(this.join('/'));
				},
				configurable: false,
				writable: false,
		  })
		: $path;
});

export const queryable = createParsableStore(($query = '') => {
	if (typeof $query === 'string') $query = parseQuery($query);
	return !Object.prototype.hasOwnProperty.call($query, 'toString')
		? Object.defineProperty($query, 'toString', {
				value() {
					return stringifyQuery(this);
				},
				configurable: false,
				writable: false,
		  })
		: $query;
});

export const fragmentable = createParsableStore(($fragment = '') => trimPrefix($fragment, '#'));

export function createParamStore(path) {
	return (pattern, options = {}) => {
		let params;

		pattern = pattern.replace(/\/$/, '');

		const { subscribe } = writable({}, (set) => {
			return path.subscribe(($path) => {
				params = parseParams($path.toString(), pattern, { blank: true, ...options });
				set(shallowCopy(params));
			});
		});

		function set(value = {}) {
			if (Object.entries(params).some(([key, val]) => val !== value[key])) {
				path.update(($path) => {
					const tail = options.loose
						? prependPrefix($path.slice(pattern.split('/').length - 1).join('/'))
						: '';
					return injectParams(pattern + tail, value);
				});
			}
		}

		return {
			get() {
				return get(this);
			},
			update(fn) {
				set(fn(this.get()));
			},
			subscribe,
			set,
		};
	};
}

function createParsableStore(parse) {
	return (value) => {
		let serialized = value && value.toString();

		const { subscribe, set } = writable(parse(value));

		function update(value) {
			value = parse(value);
			if (value.toString() !== serialized) {
				serialized = value.toString();
				set(value);
			}
		}

		return {
			subscribe,
			update(fn) {
				update(fn(get(this)));
			},
			set(value) {
				update(value);
			},
		};
	};
}
