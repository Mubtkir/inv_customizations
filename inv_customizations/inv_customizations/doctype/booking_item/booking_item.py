# Copyright (c) 2025, Khayam Khan and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class BookingItem(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		amount: DF.Currency
		description: DF.TextEditor | None
		discount_amount: DF.Currency
		item_code: DF.Link | None
		item_name: DF.Data
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		qty: DF.Float
		rate: DF.Currency
		uom: DF.Link
	# end: auto-generated types
	pass
