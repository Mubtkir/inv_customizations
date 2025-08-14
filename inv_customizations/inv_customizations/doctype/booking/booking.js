// Copyright (c) 2025, Khayam Khan and contributors
// For license information, please see license.txt

frappe.ui.form.on("Booking", {
	refresh(frm) {

	},  
    calculate_total_amount(frm) {
        let total = 0;

        frm.doc.items.forEach(item => {
            total += item.amount;
        });

        frm.set_value("total", total);
    }
});

frappe.ui.form.on("Booking Item", {
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