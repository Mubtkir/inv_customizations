# Copyright (c) 2025, Khayam Khan and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate, nowtime, now_datetime, get_datetime
from frappe import _

class Booking(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF
		from inv_customizations.inv_customizations.doctype.booking_item.booking_item import BookingItem

		amended_from: DF.Link | None
		company: DF.Link
		cost_center: DF.Link | None
		create_sales_invoice: DF.Check
		customer: DF.Link
		customer_name: DF.SmallText | None
		email_template: DF.Link
		end_date: DF.Datetime
		issue_date: DF.Datetime
		items: DF.Table[BookingItem]
		naming_series: DF.Literal["Booking-.YYYY.-"]
		notes: DF.Data | None
		sales_person: DF.Link | None
		sales_tax_template: DF.Link | None
		selling_price_list: DF.Link
		send_email: DF.Check
		start_date: DF.Datetime
		status: DF.Literal["Pending", "Booked", "Available"]
		title: DF.Data | None
		total: DF.Currency
	# end: auto-generated types
	
	def validate(self):
		self.check_end_date()
		self.set_amount_in_items()
		self.calculate_total()

	def on_submit(self):
		self.setStatus()

		if self.create_sales_invoice:
			self.create_sales_invoice_auto()
			
		if self.send_email:
			self.send_email_to_customer()

	def check_end_date(self):
		if self.end_date and self.start_date and self.end_date < self.start_date:
			frappe.throw(
				_("End Date cannot be before Start Date"),
				title=_("Invalid Dates")
			)

	def setStatus(self):
		now = now_datetime()
		
		if get_datetime(self.start_date) <= now <= get_datetime(self.end_date):
			self.status = "Booked"
		elif get_datetime(self.end_date) <= now:
			self.status = "Available"
		else:
			self.status = "Pending"

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
		company = self.get("company") or get_default_company()
		if not company:
			frappe.throw(
				_(
					"Company is mandatory for generating an invoice. Please set a default company in Global Defaults."
				)
			)
		
		sales_invoice = frappe.new_doc("Sales Invoice")
		sales_invoice.company = company
		sales_invoice.set_posting_time = 1
		sales_invoice.customer = self.customer
		sales_invoice.posting_date = nowdate()
		sales_invoice.posting_time = nowtime()
		sales_invoice.due_date = nowdate()
		sales_invoice.ignore_pricing_rule = 1
		sales_invoice.cost_center = self.cost_center

		for item in self.items:
			sales_invoice.append("items", {
				"item_code": item.item_code,
                "qty": item.qty,
                "uom": item.uom,
            	"price_list_rate": item.rate,
            	"discount_percentage": item.discount_amount or 0,				
            	"cost_center": self.cost_center,				
            })

		tax_template = self.sales_tax_template
		if tax_template:
			sales_invoice.tax_template = tax_template
			sales_invoice.set_taxes()

		sales_invoice.flags.ignore_mandatory = True

		sales_invoice.set_missing_values()
		sales_invoice.save()

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

def refresh_booking_statuses():
    """Auto-update Booking.status based on start/end datetimes."""

    now = now_datetime()

    to_book = frappe.get_all(
        "Booking",
        filters={
            "status": ["!=", "Booked"],
            "start_date": ["<=", now],
            "end_date": [">",  now],
			'docstatus': 1,
        },
       fields=['name']
    )

    if to_book:
        _bulk_update_status(to_book, "Booked")

    to_available_after = frappe.get_all(
        "Booking",
        filters={
            "status": ["!=", "Available"],
            "end_date": ["<=", now],
			'docstatus': 1,
        },
        pluck="name",
    )
    if to_available_after:
        _bulk_update_status(to_available_after, "Available")

def _bulk_update_status(names: list[str], status: str):
    for name in names:
        doc = frappe.get_doc("Booking", name)
        doc.status = status
        doc.save(ignore_permissions=True)
    frappe.db.commit()