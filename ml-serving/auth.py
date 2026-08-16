import os

import jwt
from fastapi import Header, HTTPException


def read_public_key() -> bytes:
    """Mesma lógica de resolução de caminho usada nos serviços Node
    (auth-service/auth.module.ts, api-gateway/transactions.module.ts):
    procura keys/public.pem relativo ao diretório de trabalho, e um
    nível acima."""
    candidates = [
        os.path.join(os.getcwd(), "keys", "public.pem"),
        os.path.join(os.getcwd(), "..", "keys", "public.pem"),
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            with open(candidate, "rb") as f:
                return f.read()
    raise FileNotFoundError(
        f"Chave não encontrada: public.pem (procurado em {', '.join(candidates)})"
    )


PUBLIC_KEY = read_public_key()


def verify_jwt(authorization: str = Header(default=None)) -> dict:
    """Dependency do FastAPI: exige um Bearer token RS256 válido."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Token obrigatório")

    token = authorization.replace("Bearer ", "")

    try:
        # verify_sub=False: os tokens emitidos pelos serviços Node (auth-service)
        # usam "sub" numérico (user.id), mas o PyJWT por padrão exige que "sub"
        # seja string (RFC 7519 recomenda StringOrURI). Sem isso, todo token
        # real emitido pelo auth-service seria rejeitado aqui.
        payload = jwt.decode(
            token, PUBLIC_KEY, algorithms=["RS256"], options={"verify_sub": False}
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    return payload
