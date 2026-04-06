#!/bin/bash
# ==============================================================================
# Mashora ERP — Unused Addons Cleanup Script
# ==============================================================================
# This script moves 269 unused addons to a backup folder.
# It does NOT delete them — you can restore from the backup if needed.
#
# Keeping: 348 addons (core + POS + HR + Sales + MRP + Website + Stripe + US/SA/AE/GCC + auth security)
# Removing: 269 addons (unused l10n, payment providers, test modules, misc)
#
# Usage: bash cleanup_unused_addons.sh
# ==============================================================================

set -e

ADDONS_DIR="c:/xampp/htdocs/mashora/addons"
BACKUP_DIR="c:/xampp/htdocs/mashora/_removed_addons"

echo "=== Mashora Addons Cleanup ==="
echo "Addons dir: $ADDONS_DIR"
echo "Backup dir: $BACKUP_DIR"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Count before
TOTAL_BEFORE=$(ls -d "$ADDONS_DIR"/*/ 2>/dev/null | wc -l)
echo "Total addons before cleanup: $TOTAL_BEFORE"
echo ""

# --- REMOVE LIST (269 addons) ---

REMOVE_ADDONS=(
  # Account utilities (9)
  account_add_gln
  account_check_printing
  account_debit_note
  account_peppol
  account_peppol_advanced_fields
  account_qr_code_emv
  account_qr_code_sepa
  account_test
  account_update_tax_tags

  # Payment providers -- non-Stripe (19)
  payment_adyen
  payment_aps
  payment_asiapay
  payment_authorize
  payment_buckaroo
  payment_demo
  payment_dpo
  payment_flutterwave
  payment_iyzico
  payment_mercado_pago
  payment_mollie
  payment_nuvei
  payment_paymob
  payment_paypal
  payment_razorpay
  payment_redsys
  payment_toss_payments
  payment_worldline
  payment_xendit

  # Localization -- non-US/SA/AE/GCC (202)
  l10n_account_edi_ubl_cii_tests
  l10n_anz_ubl_pint
  l10n_ar
  l10n_ar_pos
  l10n_ar_stock
  l10n_ar_website_sale
  l10n_ar_withholding
  l10n_at
  l10n_au
  l10n_bd
  l10n_be
  l10n_be_pos_restaurant
  l10n_be_pos_sale
  l10n_bf
  l10n_bg
  l10n_bg_ledger
  l10n_bh
  l10n_bj
  l10n_bo
  l10n_br
  l10n_br_sales
  l10n_br_website_sale
  l10n_ca
  l10n_cd
  l10n_cf
  l10n_cg
  l10n_ch
  l10n_ch_pos
  l10n_ci
  l10n_cl
  l10n_cm
  l10n_cn
  l10n_cn_city
  l10n_co
  l10n_co_pos
  l10n_cr
  l10n_cy
  l10n_cz
  l10n_de
  l10n_din5008
  l10n_din5008_expense
  l10n_din5008_purchase
  l10n_din5008_repair
  l10n_din5008_sale
  l10n_din5008_stock
  l10n_dk
  l10n_dk_fik
  l10n_dk_nemhandel
  l10n_dk_oioubl
  l10n_do
  l10n_dz
  l10n_ec
  l10n_ec_sale
  l10n_ec_stock
  l10n_ee
  l10n_eg
  l10n_eg_edi_eta
  l10n_es
  l10n_es_edi_facturae
  l10n_es_edi_sii
  l10n_es_edi_tbai
  l10n_es_edi_tbai_pos
  l10n_es_edi_verifactu
  l10n_es_edi_verifactu_pos
  l10n_es_pos
  l10n_et
  l10n_eu_oss
  l10n_fi
  l10n_fi_sale
  l10n_fr
  l10n_fr_account
  l10n_fr_facturx_chorus_pro
  l10n_fr_hr_holidays
  l10n_fr_hr_work_entry_holidays
  l10n_fr_pos_cert
  l10n_ga
  l10n_gn
  l10n_gq
  l10n_gr
  l10n_gr_edi
  l10n_gt
  l10n_gw
  l10n_hk
  l10n_hn
  l10n_hr
  l10n_hr_edi
  l10n_hr_kuna
  l10n_hu
  l10n_hu_edi
  l10n_id
  l10n_id_efaktur_coretax
  l10n_id_pos
  l10n_ie
  l10n_il
  l10n_in
  l10n_in_edi
  l10n_in_ewaybill
  l10n_in_ewaybill_irn
  l10n_in_ewaybill_stock
  l10n_in_hr_holidays
  l10n_in_pos
  l10n_in_purchase_stock
  l10n_in_sale
  l10n_in_sale_stock
  l10n_in_stock
  l10n_iq
  l10n_it
  l10n_it_edi
  l10n_it_edi_doi
  l10n_it_edi_ndd_account_dn
  l10n_it_edi_sale
  l10n_it_stock_ddt
  l10n_jo
  l10n_jo_edi
  l10n_jo_edi_pos
  l10n_jp
  l10n_jp_ubl_pint
  l10n_ke
  l10n_ke_edi_tremol
  l10n_kh
  l10n_km
  l10n_kr
  l10n_kw
  l10n_kz
  l10n_latam_base
  l10n_latam_check
  l10n_latam_invoice_document
  l10n_lb_account
  l10n_lk
  l10n_lt
  l10n_lu
  l10n_lv
  l10n_ma
  l10n_mc
  l10n_ml
  l10n_mn
  l10n_mr
  l10n_mt
  l10n_mt_pos
  l10n_mu_account
  l10n_mx
  l10n_my
  l10n_my_edi
  l10n_my_edi_pos
  l10n_my_ubl_pint
  l10n_mz
  l10n_ne
  l10n_ng
  l10n_nl
  l10n_no
  l10n_nz
  l10n_om
  l10n_pa
  l10n_pe
  l10n_pe_pos
  l10n_ph
  l10n_pk
  l10n_pl
  l10n_pl_edi
  l10n_pt
  l10n_qa
  l10n_ro
  l10n_ro_cpv_code
  l10n_ro_edi
  l10n_ro_edi_stock
  l10n_ro_edi_stock_batch
  l10n_rs
  l10n_rs_edi
  l10n_rw
  l10n_se
  l10n_sg
  l10n_sg_ubl_pint
  l10n_si
  l10n_sk
  l10n_sn
  l10n_syscohada
  l10n_td
  l10n_test_pos_qr_payment
  l10n_tg
  l10n_th
  l10n_tn
  l10n_tr
  l10n_tr_nilvera
  l10n_tr_nilvera_base_vat
  l10n_tr_nilvera_edispatch
  l10n_tr_nilvera_einvoice
  l10n_tr_nilvera_einvoice_extended
  l10n_tw
  l10n_tw_edi_ecpay
  l10n_tw_edi_ecpay_website_sale
  l10n_tz_account
  l10n_ua
  l10n_ug
  l10n_uk
  l10n_uy
  l10n_uy_pos
  l10n_ve
  l10n_vn
  l10n_vn_edi_viettel
  l10n_vn_edi_viettel_pos
  l10n_za
  l10n_zm_account

  # Test modules (17)
  test_base_automation
  test_crm_full
  test_discuss_full
  test_event_full
  test_html_field_history
  test_import_export
  test_mail
  test_mail_full
  test_mail_sms
  test_mass_mailing
  test_resource
  test_sale_product_configurators
  test_sale_purchase_edi_ubl
  test_spreadsheet
  test_website
  test_website_modules
  test_website_slides_full

  # Miscellaneous (17)
  api_doc
  attachment_indexation
  base_automation
  base_import_module
  base_install_request
  base_sparse_field
  cloud_storage
  cloud_storage_azure
  cloud_storage_google
  cloud_storage_migration
  data_recycle
  iot_box_image
  iot_drivers
  lunch
  partnership
  privacy_lookup
  purchase_edi_ubl_bis3
)

MOVED=0
SKIPPED=0

for addon in "${REMOVE_ADDONS[@]}"; do
  if [ -d "$ADDONS_DIR/$addon" ]; then
    mv "$ADDONS_DIR/$addon" "$BACKUP_DIR/$addon"
    echo "  Moved: $addon"
    ((MOVED++))
  else
    echo "  Skip (not found): $addon"
    ((SKIPPED++))
  fi
done

echo ""
echo "=== Cleanup Complete ==="
echo "Moved to backup: $MOVED"
echo "Not found (skipped): $SKIPPED"
TOTAL_AFTER=$(ls -d "$ADDONS_DIR"/*/ 2>/dev/null | wc -l)
echo "Addons remaining: $TOTAL_AFTER"
echo ""
echo "Backup location: $BACKUP_DIR"
echo "To restore an addon: mv $BACKUP_DIR/<addon_name> $ADDONS_DIR/"
echo "To permanently delete: rm -rf $BACKUP_DIR"
