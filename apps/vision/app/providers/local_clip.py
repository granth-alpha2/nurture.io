"""Local CLIP embedding provider with automatic SIMULATED fallback."""

import hashlib
import logging
from typing import Any, Dict, List, Optional

from app.providers.base import VisionProvider, normalize_vector
from app.providers.gemini import _pseudo_embedding_from_bytes

logger = logging.getLogger(__name__)


class LocalClipVisionProvider(VisionProvider):
    """Local CLIP vision-language model provider.
    Loads PyTorch / OpenCLIP / Transformers if available; otherwise operates
    safely in deterministic SIMULATED mode.
    """

    def __init__(self, model_name: str = "ViT-B/32"):
        self.model_name = model_name
        self._dimension = 512
        self._model = None
        self._preprocess = None
        self._tokenizer = None
        self._is_simulated = True

        # Attempt to load PyTorch and CLIP if installed
        try:
            import torch  # type: ignore
            import open_clip  # type: ignore

            model, _, preprocess = open_clip.create_model_and_transforms(
                model_name, pretrained="laion2b_s34b_b79k"
            )
            tokenizer = open_clip.get_tokenizer(model_name)
            self._model = model
            self._preprocess = preprocess
            self._tokenizer = tokenizer
            self._is_simulated = False
            logger.info(f"LocalClipVisionProvider initialized with live model {model_name}")
        except Exception:
            self._is_simulated = True
            logger.info("Local CLIP libraries not installed. Operating in SIMULATED mode.")

    @property
    def name(self) -> str:
        return "local_clip"

    @property
    def dimension(self) -> int:
        return self._dimension

    def is_simulated(self) -> bool:
        return self._is_simulated

    def health_check(self) -> bool:
        return True

    def embed_image(self, image_bytes: bytes) -> List[float]:
        if self._is_simulated or self._model is None:
            # Deterministic simulated CLIP embedding
            return _pseudo_embedding_from_bytes(b"clip_image:" + image_bytes, self._dimension)

        try:
            import io
            import torch  # type: ignore
            from PIL import Image

            image = Image.open(io.BytesIO(image_bytes))
            tensor = self._preprocess(image).unsqueeze(0)
            with torch.no_grad():
                features = self._model.encode_image(tensor)
                features /= features.norm(dim=-1, keepdim=True)
                return features[0].tolist()
        except Exception as e:
            logger.warning(f"Error computing live CLIP embedding ({e}); falling back to SIMULATED")
            return _pseudo_embedding_from_bytes(b"clip_image:" + image_bytes, self._dimension)

    def embed_text(self, text: str) -> List[float]:
        if self._is_simulated or self._model is None:
            return _pseudo_embedding_from_bytes(b"clip_text:" + text.encode("utf-8"), self._dimension)

        try:
            import torch  # type: ignore

            tokens = self._tokenizer([text])
            with torch.no_grad():
                features = self._model.encode_text(tokens)
                features /= features.norm(dim=-1, keepdim=True)
                return features[0].tolist()
        except Exception as e:
            logger.warning(f"Error computing live CLIP text embedding ({e}); falling back to SIMULATED")
            return _pseudo_embedding_from_bytes(b"clip_text:" + text.encode("utf-8"), self._dimension)

    def describe_image(self, image_bytes: bytes, context: Optional[str] = None) -> Dict[str, Any]:
        h = hashlib.sha256(image_bytes).hexdigest()
        return {
            "mode": "SIMULATED" if self._is_simulated else "LIVE",
            "provider": self.name,
            "model": self.model_name,
            "scene_tags": ["architectural_facade", "street_level"],
            "fingerprint": h[:12],
        }
