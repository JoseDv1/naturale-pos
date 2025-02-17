import type { Writable } from 'svelte/store';

export function syncStoreWithUrl<T>(store: Writable<T>, paramName: string) {
	store.subscribe((value) => {
		const urlParams = new URLSearchParams(window.location.search);
		if (value) {
			urlParams.set(paramName, String(value));
		} else {
			urlParams.delete(paramName);
		}
		const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
		window.history.replaceState(null, '', newUrl);
	})
}