// Copyright (c) 2025, Khayam Khan and contributors
// For license information, please see license.txt

frappe.listview_settings["Booking"] = {
	get_indicator: function (doc) {
		const status_colors = {
			Draft: "red",
			Available: "green",
			Pending: "gray",
			Booked: "yellow",
		};
		return [__(doc.status), status_colors[doc.status], "status,=," + doc.status];
	},
};