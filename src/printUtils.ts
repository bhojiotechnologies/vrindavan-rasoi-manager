
import { Capacitor } from "@capacitor/core";
import { Printer } from "@capgo/capacitor-printer";

export async function printCurrentPage(
  documentName: string
): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Printer.printWebView({
        name: documentName,
      });
    } else {
      window.print();
    }
  } catch (error) {
    console.error("Print Error:", error);
    alert("प्रिंट नहीं खुल पाया। कृपया दोबारा प्रयास करें।");
  }
}
