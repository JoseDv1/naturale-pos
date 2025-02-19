import { writable } from "svelte/store";
import { fetchSales, createProductOnSale, createSale, deleteProductOnSale, deleteSale, updateProductOnSale, type Sale, changePaymentMethod } from "../api/sales";
import { syncStoreWithUrl } from "../utils/stores";

const params = new URLSearchParams(window.location.search);
const initialDate = params.get('date') ?? new Date().toISOString().split("T")[0];
export const sales = writable<Sale[]>([]);
export const dateStore = writable<string>(initialDate);
syncStoreWithUrl(dateStore, 'date');



export async function setSales(date: string) {
	const data = await fetchSales(date);
	sales.set(data);
}

export async function addSale() {
	const sale = await createSale();
	sales.update(sales => [sale, ...sales]);
}

export async function removeSale(saleId: number) {
	await deleteSale(saleId.toString());
	sales.update(sales => sales.filter(sale => sale.id !== saleId));
}

export async function swapPaymentMethod(saleId: number, paymentMethod: Sale['paymentMethod']) {
	await changePaymentMethod(saleId.toString(), paymentMethod)
	sales.update((oldSales) => {
		const sale = oldSales.findIndex(sale => sale.id === saleId)
		oldSales[sale].paymentMethod = paymentMethod
		return oldSales
	})
}

// Product on sale
export async function addProductToSale(saleId: number, data: {
	productId: string,
	quantity: number
}) {
	const updatedSale = await createProductOnSale(saleId.toString(), {
		productId: data.productId,
		quantity: data.quantity
	})
	sales.update((oldSales) => {
		const sale = oldSales.findIndex(sale => sale.id === saleId)
		oldSales[sale] = updatedSale
		return oldSales
	})
}

export async function removeProductOnSale(saleId: number, productId: string) {
	const updatedSaleWhitoutProductOnSale = await deleteProductOnSale(saleId.toString(), productId)
	sales.update((oldSales) => {
		const sale = oldSales.findIndex(sale => sale.id === saleId)
		oldSales[sale] = updatedSaleWhitoutProductOnSale
		return oldSales
	})
}

export async function editProductOnSale(saleId: number, productId: string, data: {
	quantity: number,
	unitPrice: number
}) {
	const udpatedSale = await updateProductOnSale(saleId.toString(), productId, data)
	sales.update((oldSales) => {
		const sale = oldSales.findIndex(sale => sale.id === saleId)
		oldSales[sale] = udpatedSale
		return oldSales
	})

}
