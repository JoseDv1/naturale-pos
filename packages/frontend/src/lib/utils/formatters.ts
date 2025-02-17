
export const moneyFormatter = new Intl.NumberFormat(
	"es-CO",
	{
		style: "currency",
		currency: "COP"
	}
).format

export const dateHoursFormatter = new Intl.DateTimeFormat("es-CO", {
	hour: "2-digit",
	minute: "2-digit",
}).format

export const fullDateFormatter = new Intl.DateTimeFormat("es-CO", {
	year: "numeric",
	month: "long",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit"
}).format

export const idFormatter = (id: string) => {
	return id.split("-")[0].toUpperCase()
}