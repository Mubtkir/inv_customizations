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
        const row = frappe.get_doc(cdt, cdn);
        if (!row.item_code || !frm.doc.selling_price_list) return;

        frappe.call({
            method: "frappe.client.get_value",
            args: {
                doctype: "Item Price",
                filters: { item_code: row.item_code, price_list: frm.doc.selling_price_list },
                fieldname: "price_list_rate"
            },
            callback: function(res) {
                const plr = res?.message?.price_list_rate;
                if (plr != null) {
                    frappe.model.set_value(cdt, cdn, "price_list_rate", plr);
                    frappe.model.set_value(cdt, cdn, "rate", plr);
                    apply_qty_rule_and_override(frm, cdt, cdn); // only if base price exists
                } else {
                    if (row.rate) {
                        frappe.model.set_value(cdt, cdn, "price_list_rate", row.rate);
                    }
                }
            }
        });
    },
    qty(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        set_amount_from_rate(frm, cdt, cdn);

        if (row.item_code && frm.doc.selling_price_list) {
            apply_qty_rule_and_override(frm, cdt, cdn);
        }
    },

    rate(frm, cdt, cdn) {
        const row = locals[cdt][cdn];

        if (!flt(row.price_list_rate)) {
            frappe.model.set_value(cdt, cdn, "price_list_rate", flt(row.rate));
        }

        if (flt(row.price_list_rate)) {
            const pct = (1 - (flt(row.rate) / flt(row.price_list_rate))) * 100.0;
            frappe.model.set_value(cdt, cdn, "discount_amount", Math.max(0, pct));
        }

        set_amount_from_rate(frm, cdt, cdn);
    },
    discount_amount(frm, cdt, cdn) {
        const row = locals[cdt][cdn];

        if (row.discount_amount > 100) frappe.model.set_value(cdt, cdn, 'discount_amount', 100.0);
        if (row.discount_amount < 0)   frappe.model.set_value(cdt, cdn, 'discount_amount', 0.0);

        const base = flt(row.price_list_rate) || flt(row.rate);   // ← fallback to current rate
        if (base) {
            const new_rate = base * (1 - flt(row.discount_amount) / 100.0);
            frappe.model.set_value(cdt, cdn, "rate", new_rate);

            if (!flt(row.price_list_rate)) {
                frappe.model.set_value(cdt, cdn, "price_list_rate", base);
            }
        }

        set_amount_from_rate(frm, cdt, cdn);
    },
    items_add(frm)    { frm.trigger("calculate_total_amount"); },
    items_remove(frm) { frm.trigger("calculate_total_amount"); },
});

function set_amount_from_rate(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    const amount = flt(row.qty) * flt(row.rate);
    frappe.model.set_value(cdt, cdn, "amount", amount);
    frm.refresh_field("items");
    frm.trigger("calculate_total_amount");
}

function flt(v){ return parseFloat(v || 0) || 0; }

function apply_qty_rule_and_override(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    const base = flt(row.price_list_rate) || flt(row.rate) || 0;  // 👈 fallback

    if (!base) {
        set_amount_from_rate(frm, cdt, cdn);
        return;
    }

    frappe.call({
        method: "inv_customizations.inv_customizations.doctype.booking.booking.get_qty_discount_for_item",
        args: {
            item_code: row.item_code,
            qty: row.qty || 1,
            price_list: frm.doc.selling_price_list,
            company: frm.doc.company || null,
            base_rate: base,
        },
        callback: function(r) {
            if (!r || !r.message) return;
            const out = r.message;

            const final_rate = flt(out.discounted_rate) || base;

            frappe.model.set_value(cdt, cdn, "discount_amount", out.discount_percentage || 0);
            frappe.model.set_value(cdt, cdn, "rate", final_rate);

            set_amount_from_rate(frm, cdt, cdn);
        }
    });
}
