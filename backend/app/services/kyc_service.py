import base64
import re
from thefuzz import fuzz
from logifyx import Logifyx
from typing import Optional
from app.helper.verhoeff import validate_aadhaar
import pytesseract
import cv2
import numpy as np

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

log = Logifyx(name="wealthvault-kyc")

class KYCService:
    
    async def ocr_base64_image(self, image_b64: str) -> Optional[str]:
        """
        OCR from base64 encoded image.

        Args:
            image_b64: Base64 encoded image

        Returns:
            Extracted text or None
        """

        try:
            if not image_b64:
                return ""

            # Remove header if present
            if "," in image_b64:
                image_b64 = image_b64.split(",")[1]

            # Decode base64
            image_bytes = base64.b64decode(image_b64)

            # Convert to OpenCV image
            np_arr = np.frombuffer(image_bytes, np.uint8)

            image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if image is None:
                raise ValueError("Invalid image")

            # Preprocessing for OCR
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

            gray = cv2.GaussianBlur(gray, (3, 3), 0)

            gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

            # OCR
            text = pytesseract.image_to_string(gray, config="--oem 3 --psm 6")

            text = " ".join(text.split())
            log.info(f"🖊️OCR extracted text: {text[:100]}...")  # Log first 100 chars

            return text

        except Exception as e:
            log.error(f"OCR Error: {e}")
            return None

    async def process_kyc_documents(self, aadhaar_front_b64, aadhaar_back_b64, pan_b64):
        """
        Main entry point for KYC processing.
        Uses Vision AI -> Regex Extraction -> Validation -> Scoring.
        """
        results = {
            "Aadhaar": {"readable": False, "raw_text": "", "fields": {}},
            "PAN": {"readable": False, "raw_text": "", "fields": {}},
            "flags": [],
            "confidence_score": 0,
            "analysis": ""
        }

        # 1. OCR (Vision API with Tesseract Fallback)
        aadhaar_text = await self._get_ocr_text(aadhaar_front_b64, aadhaar_back_b64)
        pan_text = await self._get_ocr_text(pan_b64)

        results["Aadhaar"]["raw_text"] = aadhaar_text
        results["PAN"]["raw_text"] = pan_text

        # 2. Extract structured fields using Regex
        aadhaar_fields = self._extract_aadhaar_fields(aadhaar_text)
        pan_fields = self._extract_pan_fields(pan_text)

        results["Aadhaar"]["fields"] = aadhaar_fields
        results["PAN"]["fields"] = pan_fields
        results["Aadhaar"]["readable"] = bool(aadhaar_fields.get("raw"))
        results["PAN"]["readable"] = bool(pan_fields.get("raw"))

        # 3. Build Validation & Fraud Rules
        self._run_fraud_detection(results)

        # 4. Confidence Scoring
        results["confidence_score"] = self._calculate_confidence(results)
        
        # 5. Final Analysis Message
        results["analysis"] = self._generate_analysis_summary(results)

        return results

    async def _get_ocr_text(self, *images):
        """
        Supports:
        - Aadhaar front + back
        - PAN
        """

        extracted = []

        for image in images:
            if image:
                text = await self.ocr_base64_image(image)  # keep raw for KYC validation

                if text:
                    extracted.append(text)

        return "\n".join(extracted)

    def _call_tesseract(self, b64_content):
        """Local OCR Fallback using Pytesseract & OpenCV."""
        try:
            nparr = np.frombuffer(base64.b64decode(b64_content), np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Preprocessing: Grayscale + Threshold
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
            
            text = pytesseract.image_to_string(thresh)
            return text
        except Exception as e:
            log.error(f"Tesseract Error: {e}")
            return None

    def _extract_aadhaar_fields(self, text):
        if not text: return {}
        
        # Regex for Aadhaar (12 digits with spaces or hyphens)
        aadhaar_pattern = r"\b\d{4}\s?\d{4}\s?\d{4}\b"
        # Regex for DOB (DD/MM/YYYY or DD-MM-YYYY)
        dob_pattern = r"\b(\d{2}[-/]\d{2}[-/]\d{4})\b"
        
        aadhaar_match = re.search(aadhaar_pattern, text)
        dob_match = re.search(dob_pattern, text)
        
        lines = text.split("\n")
        # Heuristic for name: Usually after "To" or at the top
        name = ""
        for line in lines[:10]:
            clean = line.strip()
            if len(clean) > 5 and not any(x in clean.lower() for x in ["government", "aadhaar", "unique", "enrollment"]):
                name = clean
                break

        raw_id = aadhaar_match.group(0).replace(" ", "") if aadhaar_match else ""
        
        return {
            "Full Name": name,
            "DOB": dob_match.group(0) if dob_match else "",
            "raw": raw_id,
            "masked": f"XXXX-XXXX-{raw_id[-4:]}" if len(raw_id) == 12 else ""
        }

    def _extract_pan_fields(self, text):
        if not text: return {}
        
        # Regex for PAN (5 letters, 4 digits, 1 letter)
        pan_pattern = r"\b[A-Z]{5}\d{4}[A-Z]\b"
        dob_pattern = r"\b(\d{2}[-/]\d{2}[-/]\d{4})\b"
        
        pan_match = re.search(pan_pattern, text)
        dob_match = re.search(dob_pattern, text)
        
        lines = text.split("\n")
        # PAN Name is usually at the top or after Income Tax Dept
        name = ""
        for i, line in enumerate(lines[:8]):
            if "tax" in line.lower() or "department" in line.lower():
                if i+1 < len(lines): name = lines[i+1].strip()
                break
        
        if not name and lines: name = lines[0].strip()

        raw_id = pan_match.group(0) if pan_match else ""
        
        return {
            "Full Name": name,
            "DOB": dob_match.group(0) if dob_match else "",
            "raw": raw_id,
            "masked": f"{raw_id[:5]}XXXX{raw_id[-1:]}" if len(raw_id) == 10 else ""
        }

    def _run_fraud_detection(self, results):
        aadhaar = results["Aadhaar"]["fields"]
        pan = results["PAN"]["fields"]
        
        # 1. Aadhaar Checksum (Verhoeff)
        if aadhaar.get("raw"):
            if not validate_aadhaar(aadhaar["raw"]):
                results["flags"].append("ERROR: Aadhaar Checksum Failed (Invalid Number)")
        
        # 2. PAN Validation (Type 'P')
        if pan.get("raw"):
            if len(pan["raw"]) == 10:
                if pan["raw"][3] != 'P':
                    results["flags"].append("WARNING: PAN not for Individual (4th char should be 'P')")
                if not re.match(r"[A-Z]{5}[0-9]{4}[A-Z]", pan["raw"]):
                    results["flags"].append("ERROR: Invalid PAN Format")
        
        # 3. Name Mismatch
        if aadhaar.get("Full Name") and pan.get("Full Name"):
            ratio = fuzz.token_sort_ratio(aadhaar["Full Name"].lower(), pan["Full Name"].lower())
            if ratio < 80:
                results["flags"].append(f"CRITICAL: Name Mismatch between Aadhaar & PAN ({ratio}% match)")

        # 4. DOB Mismatch
        if aadhaar.get("DOB") and pan.get("DOB"):
            if aadhaar["DOB"] != pan["DOB"]:
                results["flags"].append("WARNING: Date of Birth mismatch between documents")

    def _calculate_confidence(self, results):
        score = 0
        aadhaar = results["Aadhaar"]["fields"]
        pan = results["PAN"]["fields"]
        
        # Aadhaar scoring (Max 50)
        if aadhaar.get("raw"): score += 30
        if aadhaar.get("Full Name"): score += 10
        if aadhaar.get("DOB"): score += 10
        
        # PAN scoring (Max 50)
        if pan.get("raw"): score += 30
        if pan.get("Full Name"): score += 10
        if pan.get("DOB"): score += 10
        
        # Penalties for flags
        for flag in results["flags"]:
            if "CRITICAL" in flag: score -= 40
            if "ERROR" in flag: score -= 20
            if "WARNING" in flag: score -= 10
            
        return max(0, min(100, score))

    def _generate_analysis_summary(self, results):
        if not results["flags"]:
            if results["confidence_score"] > 90: return "Everything looks perfect. Authentic documents detected."
            return "Documents readable but some fields missing."
        
        return f"Detected {len(results['flags'])} issue(s). Please review the high-priority flags."

kyc_service = KYCService()
