/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

// created by krushna

define(['N/record', 'N/search', 'N/redirect', 'N/ui/serverWidget', '../reversalLib'], (record, search, redirect, ui, rev) => {
    const onRequest = (scriptContext) => {

        if (scriptContext.request.method === 'GET') {
            var form = ui.createForm({
                title: 'Create Reversal journal Entry',
                id: 'custpage_form'
            });
            var revDate = form.addField({
                type: 'date',
                id: 'custpage_revdate',
                label: 'Select Reversal Date'
            });
            revDate.isMandatory = true;

            // get curr id
            var custpayIdval = form.addField({
                type: 'text',
                id: 'currentrecid',
                label: 'Record Id'
            });
            custpayIdval.updateDisplayType({
                displayType: ui.FieldDisplayType.HIDDEN
            });
            let currRecId = scriptContext.request.parameters.cust_current_rec_id;
            if (currRecId) {
                custpayIdval.defaultValue = currRecId
            }

            // type curr get

            var currRecTypeVal = form.addField({
                type: 'text',
                id: 'currentrectype',
                label: 'Record Type'
            });
            currRecTypeVal.updateDisplayType({
                displayType: ui.FieldDisplayType.HIDDEN
            });
            let currRecType = scriptContext.request.parameters.cust_current_rec_type;
            log.debug('currRecType', currRecType);

            let paraRevReason = scriptContext.request.parameters.cust_reversal_reason;
            log.debug('paraRevReason', paraRevReason);

            if (currRecType) {
                currRecTypeVal.defaultValue = currRecType
            }
            let revReason;

            if (currRecType === 'customerpayment') {
                revReason = form.addField({
                    type: 'select',
                    id: 'revreason',
                    label: 'Select Reversal Reason',
                    source: 'customlist_reversal_reason_cp'
                });
                revReason.isMandatory = true;

                if (paraRevReason) {
                    revReason.defaultValue = paraRevReason
                }

            } else if (currRecType === 'creditmemo') {
                revReason = form.addField({
                    type: 'select',
                    id: 'revreason',
                    label: 'Select Reversal Reason',
                    source: 'customlist_reversal_reason_cm'
                });
                revReason.isMandatory = true;
                if (paraRevReason) {
                    revReason.defaultValue = paraRevReason
                }
            }

            form.addSubmitButton({
                buttonid: 'subbutton',
                label: 'Submit'
            });
            scriptContext.response.writePage(form);
        } else {
            log.debug('context else ', scriptContext);
            let currRecId = scriptContext.request.parameters.currentrecid;
            log.debug('currRecId', currRecId);
            let currRecType = scriptContext.request.parameters.currentrectype;
            log.debug('currRecType', currRecType);
            let revDate = scriptContext.request.parameters.custpage_revdate;
            log.debug('revDate', revDate);
            let revReason = scriptContext.request.parameters.revreason;
            log.debug('revReason', typeof revReason);

            let revReasonTxt = scriptContext.request.parameters.inpt_revreason;
            log.debug('revReasonTxt', revReasonTxt);

            if (currRecType === 'customerpayment') {

                let custPayJE = rev.createRevJEforCustPay(currRecId, revDate, revReason, currRecType, revReasonTxt);
                log.debug('custPayJE', custPayJE);
                if (custPayJE) {

                    let payDocNo;
                    var payRec = record.load({
                        type: currRecType,
                        id: currRecId,
                        isDynamic: false
                    });

                    payDocNo = payRec.getValue({
                        fieldId: 'tranid'
                    });
                    log.debug('Doc No', payDocNo);

                    payRec.setValue({
                        fieldId: 'custbody_reverse_je',
                        value: custPayJE
                    });

                    payRec.setValue({
                        fieldId: 'custbody_reversal_reason_cp',
                        value: revReason
                    });

                    // set apply sublist
                    const invoiceCount = payRec.getLineCount({
                        sublistId: 'apply'
                    });
                    log.debug('invoiceCount', invoiceCount);

                    for (var i = 0; i < invoiceCount; i++) {
                        payRec.setSublistValue({
                            sublistId: 'apply',
                            fieldId: 'apply',
                            line: i,
                            value: false
                        });

                        log.debug('tran type', payRec.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'trantype',
                                line: i
                            }));

                        if (payRec.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'internalid',
                                line: i
                            }) == custPayJE && payRec.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'trantype',
                                line: i
                            }) == 'Journal') {
                            payRec.setSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply',
                                line: i,
                                value: true
                            });
                        }
                    }

                    var savePayment = payRec.save({
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    });
                    log.debug('savePayment', savePayment);
                }
                // redirect to customer payment
                let toCustPay = redirect.toRecord({
                    type: record.Type.CUSTOMER_PAYMENT,
                    id: currRecId
                });
            }

            if (currRecType === 'creditmemo') {

                let custRfndJE = rev.createCustRfndAndVoid(currRecId, revDate, revReason, currRecType, revReasonTxt);
                log.debug('custRfndJE', custRfndJE);

                if (custRfndJE) {

                    var cmRec = record.load({
                        type: currRecType,
                        id: currRecId,
                        isDynamic: false
                    });

                    cmRec.setValue({
                        fieldId: 'custbody_reverse_je',
                        value: custRfndJE
                    });

                    cmRec.setValue({
                        fieldId: 'custbody_reversal_reason_cm',
                        value: revReason
                    });

                    // apply JE on CM
                    let invoiceCount = cmRec.getLineCount({
                        sublistId: 'apply'
                    });
                    log.debug('invoiceCount', invoiceCount);

                    for (let i = 0; i < invoiceCount; i++) {
                        cmRec.setSublistValue({
                            sublistId: 'apply',
                            fieldId: 'apply',
                            line: i,
                            value: false
                        });

                        if (cmRec.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'internalid',
                                line: i
                            }) == custRfndJE) {

                            log.debug('111111', '11111111111');

                            cmRec.setSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply',
                                line: i,
                                value: true
                            });

                        }

                    }

                    // save CM recalc
                    let saveCreditMemo = cmRec.save({
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    });
                    log.debug('saveCreditMemo', saveCreditMemo);

                    let cmRecLoad = record.load({
                        type: currRecType,
                        id: currRecId,
                        isDynamic: false
                    });

                    let applySubCount = cmRecLoad.getLineCount({
                        sublistId: 'apply'
                    });

                    for (let i = 0; i < applySubCount; i++) {

                        if (cmRecLoad.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'internalid',
                                line: i
                            }) == custRfndJE && cmRecLoad.getSublistValue({
                                sublistId: 'apply',
                                fieldId: 'trantype',
                                line: i
                            }) == 'Journal') {

                            cmRecLoad.setSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply',
                                line: i,
                                value: true
                            });
                        }
                    }

                    let saveCmRecLoad = cmRecLoad.save({
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    });
                    log.debug('saveCmRecLoad', saveCmRecLoad);

                }

                // redirect to credit memo
                let toCreditMemo = redirect.toRecord({
                    type: record.Type.CREDIT_MEMO,
                    id: currRecId
                });
            }

        }
    }

    return {
        onRequest
    }
});
