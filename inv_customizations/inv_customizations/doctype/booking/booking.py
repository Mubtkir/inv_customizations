# Copyright (c) 2025, Khayam Khan and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate, nowtime, add_days

class Booking(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF
		from inv_customizations.inv_customizations.doctype.booking_item.booking_item import BookingItem

		amended_from: DF.Link | None
		company: DF.Link
		create_sales_invoice: DF.Check
		customer: DF.Link
		customer_name: DF.SmallText | None
		email_template: DF.Link
		end_date: DF.Datetime
		issue_date: DF.Date
		issue_time: DF.Time
		items: DF.Table[BookingItem]
		naming_series: DF.Literal["Booking-.YYYY.-"]
		note: DF.TextEditor | None
		sales_person: DF.Data | None
		send_email: DF.Check
		start_date: DF.Datetime
		title: DF.Data | None
		total: DF.Currency
	# end: auto-generated types
	
	def validate(self):
		self.set_amount_in_items()
		self.calculate_total()

	def on_submit(self):
		if self.create_sales_invoice:
			self.create_sales_invoice_auto()
			
		if self.send_email:
			self.send_email_to_customer()

	def send_email_to_customer(self):
		emails = get_customer_emails(self.customer)
		if not emails:
			return

		tmpl = frappe.get_doc("Email Template", self.email_template)
		ctx = self.as_dict()
		subject = frappe.render_template(tmpl.subject or "", ctx)
		message = frappe.render_template(tmpl.response or "", ctx)
		frappe.sendmail(
			recipients=emails,
            subject=subject,
            message=message,
        )

	def create_sales_invoice_auto(self):
		sales_invoice = frappe.new_doc("Sales Invoice")
		sales_invoice.customer = self.customer
		sales_invoice.posting_date = nowdate()
		sales_invoice.posting_time = nowtime()
		sales_invoice.due_date = nowdate()
		sales_invoice.ignore_pricing_rule = 1
		sales_invoice.company = self.company
		
		for item in self.items:
			sales_invoice.append("items", {
				"item_code": item.item_code,
                "qty": item.qty,
                "uom": item.uom,
            	"price_list_rate": item.rate,
            	"discount_percentage": item.discount_amount or 0,				
            })
		
		sales_invoice.set_missing_values()
		sales_invoice.calculate_taxes_and_totals()
		
		sales_invoice.insert(ignore_permissions=True)

	def set_amount_in_items(self):
		for item in self.items:
			total = item.qty * item.rate
			if item.discount_amount:
				discount = (item.discount_amount / 100) * total
			else:
				discount = 0
			item.amount = total - discount

	def calculate_total(self):
		self.total = sum(item.amount for item in self.items if item.amount)
		if not self.total:
			self.total = 0.0


def get_customer_emails(customer):
	contact_links = frappe.get_all('Dynamic Link', filters={
		'parenttype': 'Contact',
		'link_doctype': 'Customer',
        'link_name': customer
    }, fields=['parent'])
	
	emails = []
	
	for link in contact_links:
		contact_emails = frappe.get_all('Contact Email', filters={'parent': link.parent}, fields=['email_id'])
		for email in contact_emails:
			if email.email_id:
				emails.append(email.email_id)
	
	return emails if emails else None