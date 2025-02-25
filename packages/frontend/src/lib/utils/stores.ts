import type { Writable } from 'svelte/store';


/**
 * Sincroniza un almacén reactivo (store) con la URL.
 *
 * Esta función se suscribe al almacén y actualiza el parámetro especificado en la URL cada vez que cambia el valor del almacén.
 * Si el valor es "truthy", se establece el parámetro con el valor convertido a cadena; de lo contrario, se elimina el parámetro de la URL.
 * Se utiliza window.history.replaceState para modificar la URL sin recargar la página.
 *
 * @param store - El almacén reactivo cuya información se sincroniza con la URL.
 * @param paramName - El nombre del parámetro en la URL que se actualizará según el valor del almacén.
 * @example
 * ```ts
 * const params = new URLSearchParams(window.location.search);
 * const initialDate = params.get('date') ?? new Date().toISOString().split("T")[0];
 * export const dateStore = writable<string>(initialDate);
 * syncStoreWithUrl(dateStore, 'date');
 * ```
 */
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