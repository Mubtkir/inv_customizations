// Copyright (c) 2025, Khayam Khan and contributors
// For license information, please see license.txt

frappe.ui.form.on("Booking", {
	setup: function (frm) {
		frm.set_query("cost_center", function () {
			return {
				filters: {
					company: frm.doc.company,
				},
			};
		});

		frm.set_query("sales_tax_template", function () {
			return {
				filters: {
					company: frm.doc.company,
				},
			};
		});
	},    
	refresh(frm) {
        // set_default_tax(frm);
	},
    company(frm) { 
        set_default_tax(frm);
    },
    calculate_total_amount(frm) {
        let total = 0;

        frm.doc.items.forEach(item => {
            total += item.amount;
        });

        frm.set_value("total", total);
    }
});

function set_default_tax(frm) {
    if (!frm.doc.company || frm.doc.sales_tax_template) return;
    frappe.db.get_value(
        "Sales Taxes and Charges Template",
        { company: frm.doc.company, is_default: 1, disabled: 0 },
        "name"
    ).then(r => {
        const name = r?.message?.name;
        if (name) frm.set_value("sales_tax_template", name);
    });
}

frappe.ui.form.on("Booking Item", {
    item_code: function(frm, cdt, cdn) {
        var row = frappe.get_doc(cdt, cdn);
        if (!row.item_code || !frm.doc.selling_price_list) return;

        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Item Price",
                filters: {
                    item_code: row.item_code,
                    price_list: frm.doc.selling_price_list
                },
                fieldname: "price_list_rate"
            },
            callback: function(res) {
                if (res && res.message) {
                    frappe.model.set_value(cdt, cdn, "rate", res.message.price_list_rate);
                }
            }
        });
    },
    amount(frm) {
        frm.trigger("calculate_total_amount");
    },

    qty(frm, cdt, cdn) {
        const item = locals[cdt][cdn];

        if (item.rate && item.qty) {
            const total = item.rate * item.qty;
            const discount = (item.discount_amount / 100) * total;
            item.amount = total - discount;
            frm.refresh_field("items");
            frm.trigger("calculate_total_amount");
        }
    },

    rate(frm, cdt, cdn) {
        const item = locals[cdt][cdn];
        
        if (item.rate && item.qty) {
            const total = item.rate * item.qty;
            const discount = (item.discount_amount / 100) * total;
            item.amount = total - discount;
            frm.refresh_field("items");
            frm.trigger("calculate_total_amount");
        }
    },

    discount_amount(frm, cdt, cdn) {
        const item = locals[cdt][cdn];

        if (item.discount_amount > 100) {
            frappe.model.set_value(cdt, cdn, 'discount_amount', 100.0);
        }

        if (item.discount_amount < 0) {
            frappe.model.set_value(cdt, cdn, 'discount_amount', 0.0);
        }        

        if (item.rate && item.qty) {
            const total = item.rate * item.qty;
            const discount = (item.discount_amount / 100) * total;
            item.amount = total - discount;
            frm.refresh_field("items");
            frm.trigger("calculate_total_amount");
        }
    },

    items_add(frm) {
        frm.trigger("calculate_total_amount");
    },

    items_remove(frm) {
        frm.trigger("calculate_total_amount");
    },    
});