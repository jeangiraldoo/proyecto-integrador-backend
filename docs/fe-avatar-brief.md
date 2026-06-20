# Avatar URL — Frontend Integration Brief

## Situación actual

Los avatares de usuario no estaban centralizados: el registro con Google guardaba la foto de Google
en algunos casos, el registro por formulario no guardaba ninguna URL, y la sala mostraba el avatar
por defecto siempre porque el campo llegaba vacío desde el backend.

## Solución implementada en el backend

El backend ahora garantiza que **todo usuario tiene un `avatarUrl` válido desde el momento del
registro**, sin depender de Firebase Storage ni de ninguna subida de archivos:

| Flujo de registro                                   | Fuente del `avatarUrl`                      |
| --------------------------------------------------- | ------------------------------------------- |
| Google OAuth (`complete-profile`)                   | `photoURL` del token de Google              |
| Google sin foto de perfil                           | Avatar de iniciales generado en el servidor |
| Formulario (`signup`)                               | Avatar de iniciales generado en el servidor |
| Usuario actualiza su perfil (`PATCH /auth/profile`) | URL enviada por el cliente                  |

Los avatares de iniciales se generan con [ui-avatars.com](https://ui-avatars.com), un servicio
público que convierte un nombre en una imagen PNG. La URL es determinística: el mismo usuario
siempre recibe el mismo color de fondo (derivado de su username). No hay dependencia de
almacenamiento.

Ejemplo de URL generada:

```
https://ui-avatars.com/api/?name=Juan%20Rodriguez&background=6366f1&color=fff&bold=true&size=128
```

## Dónde aparece el campo `avatarUrl`

### 1. `GET /auth/profile`

```json
{
  "profile": {
    "uid": "abc123",
    "username": "juanr",
    "displayName": "Juan Rodriguez",
    "avatarUrl": "https://ui-avatars.com/api/?name=Juan%20Rodriguez&...",
    ...
  }
}
```

### 2. Socket — evento `room_joined`

```json
{
  "roomId": "ABC-1234",
  "isAdmin": true,
  "participants": [{ "uid": "xyz", "username": "peer1", "avatarUrl": "https://..." }]
}
```

### 3. Socket — evento `participant_joined` / `participant_left`

```json
{
  "roomId": "ABC-1234",
  "uid": "xyz",
  "username": "peer1",
  "avatarUrl": "https://..."
}
```

## Lo que el frontend debe implementar

### Mostrar el avatar en cualquier contexto

El campo `avatarUrl` siempre es un string no vacío para usuarios nuevos. Para usuarios existentes en
Firestore (anteriores al cambio) puede ser `null` — usar un fallback:

```tsx
<img
  src={user.avatarUrl ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}`}
  alt={user.username}
/>
```

### Mostrar avatares de participantes en la sala

Al recibir `room_joined`, iterar `participants` y mostrar el `avatarUrl` de cada uno. Actualizar la
lista de avatares visibles al recibir `participant_joined` (agregar) y `participant_left` (quitar).

### Cambiar el avatar desde el dashboard

El endpoint para editar la foto de perfil ya existe: `PATCH /auth/profile`. Desde el dashboard,
mostrar un input de texto o modal donde el usuario pegue una URL pública (foto de otra red,
Gravatar, etc.) y enviarla así:

```
PATCH /auth/profile
Authorization: Bearer <idToken>

{ "avatarUrl": "https://example.com/mi-foto.jpg" }
```

La respuesta devuelve el perfil actualizado con el nuevo `avatarUrl`. No hay endpoint de subida de
archivos — el usuario provee una URL directamente. Si en el futuro se quiere subida de archivos,
requeriría Firebase Storage o un CDN externo (fuera del alcance actual).

## Notas para la implementación

- No almacenes el `avatarUrl` en estado local del cliente de forma permanente; siempre obtenerlo de
  `/auth/profile` o de los eventos de socket para mantenerlo actualizado.
- El avatar no cambia en la sesión activa a menos que el usuario haga `PATCH /auth/profile` y el
  front recargue el perfil.
- Los participantes de la sala que ya estaban conectados cuando tú llegas aparecen en el array
  `participants` de `room_joined` — úsalos para renderizar el estado inicial de la sala, no hagas un
  fetch a Firestore.
