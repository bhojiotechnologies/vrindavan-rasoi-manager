वृंदावन रसोई — Customer Udhaar Khata Patch

यह patch मौजूदा ऐप में उधार बिल, केवल राशि वाली बिल एंट्री, आंशिक भुगतान और ग्राहक का तारीखवार प्रिंट/PDF खाता जोड़ता है। पुराने sale/payment records को overwrite या delete नहीं करता।

GitHub में अपने मौजूदा repository के src/ में ये फाइलें replace/add करें:
1) src/SalesBilling.tsx                 (replace)
2) src/saleService.ts                   (replace)
3) src/customerLedgerService.ts         (new file)
4) src/CustomerLedger.tsx               (new file)
5) src/App.tsx                          (replace; CustomerLedger को Customers स्क्रीन के नीचे जोड़ता है)

Repository root में firestore.rules को patch में दी गई firestore.rules से replace करें और Firebase Console में Rules Publish करें।

महत्वपूर्ण:
- src/customerService.ts, src/schema.ts, src/InvoicePreview.tsx को बदलने की जरूरत नहीं है; मौजूदा versions इस्तेमाल होंगे।
- Customers मॉड्यूल खोलने पर Customer Ledger नीचे दिखेगा।
- उधार के लिए सेव ग्राहक चुनना अनिवार्य है। Walk-in ग्राहक को बकाया नहीं दिया जा सकता।
- सामान/मात्रा वाली एंट्री सामान्य Item से होगी। केवल रकम के लिए “केवल राशि की एंट्री” इस्तेमाल करें। यह बिल में “खाता एंट्री (केवल राशि)” नाम से दिखेगी।
- भुगतान बाद में Customers > ग्राहक उधार खाता में दर्ज करें। Cash/UPI payment अलग customerPayments रिकॉर्ड में append होगा।
- PDF/प्रिंट बटन ग्राहक का तारीखवार विवरण प्रिंट डायलॉग में खोलेगा; Android पर Save as PDF चुनें।
- Existing old sales में paidAmount न होने पर ledger cashAmount + upiAmount + advanceUsed से शुरुआती भुगतान निकालेगा।

जांच:
- सभी patch TypeScript/TSX फाइलों की syntax parsing जांच सफल रही।
- यह आपके GitHub/Firebase पर deploy नहीं किया गया है और पूर्ण repository build/runtime test नहीं हुआ है। Deploy से पहले GitHub Actions build देखें और Firebase Rules publish करें।
