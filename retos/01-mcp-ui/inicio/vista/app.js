// Código de la vista: se ejecuta dentro del iframe que muestra el cliente MCP.
import { App } from '@modelcontextprotocol/ext-apps';

const $productos = document.querySelector('#productos');
const $titulo = document.querySelector('#titulo');
const $carrito = document.querySelector('#carrito');
const $estado = document.querySelector('#estado');

const app = new App({ name: 'Catálogo de la tienda', version: '1.0.0' });

const euros = (cantidad) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cantidad);

function pintarProductos(productos) {
  $titulo.textContent = `${productos.length} ${productos.length === 1 ? 'producto' : 'productos'}`;
  $estado.textContent = productos.length === 0 ? 'No hay productos que coincidan con la búsqueda.' : '';

  $productos.replaceChildren(
    ...productos.map((producto) => {
      const $item = document.createElement('li');
      $item.className = 'producto';
      $item.innerHTML = `
        <span class="emoji" aria-hidden="true"></span>
        <span class="nombre"></span>
        <p class="descripcion"></p>
        <div class="pie">
          <span class="precio"></span>
          <button class="añadir" type="button">Añadir</button>
        </div>`;
      $item.querySelector('.emoji').textContent = producto.emoji;
      $item.querySelector('.nombre').textContent = producto.nombre;
      $item.querySelector('.descripcion').textContent = producto.descripcion;
      $item.querySelector('.precio').textContent = `${euros(producto.precio)} · ★ ${producto.valoracion}`;
      $item.querySelector('button').addEventListener('click', (evento) => añadir(producto, evento.currentTarget));
      return $item;
    }),
  );
}

function pintarCarrito(carrito) {
  $carrito.textContent = `Carrito · ${carrito.unidades} · ${euros(carrito.total)}`;
}

async function añadir(producto, $boton) {
    $boton.disabled = true;
    $estado.textContent = '';

    try {
        const resultado = await app.callServerTool({
            name: 'anadir_al_carrito',
            arguments: { id: producto.id, cantidad: 1 },
        });

        if (resultado.isError) {
            $estado.textContent = resultado.content?.[0]?.text ?? 'No se pudo añadir el producto.';
            return;
        }

        pintarCarrito(resultado.structuredContent);

        $estado.textContent = `${producto.nombre} añadido al carrito.`;

        const { unidades, total } = resultado.structuredContent;
        await app.updateModelContext({
            content: [
                {
                    type: 'text',
                    text: `El usuario ha añadido "${producto.nombre}" al carrito desde la interfaz. Ahora hay ${unidades} unidades (${total} €).`,
                },
            ],
        });

    } catch (error) {
        $estado.textContent = `Error: ${error.message}`;
    } finally {
        $boton.disabled = false;
    }
}

app.addEventListener('toolresult', (resultado) => {
    const {productos, carrito} = resultado.structuredContent ?? {};
    if (productos) pintarProductos(productos);
    if (carrito) pintarCarrito(carrito);
});

// El botón del carrito le pide al asistente que continúe la conversación
$carrito.addEventListener('click', () => {
  app.sendMessage({
    role: 'user',
    content: [{ type: 'text', text: 'Enséñame el carrito y dime el total.' }],
  });
});

// 1. Conectamos con el cliente (siempre después de registrar los eventos)
await app.connect();
