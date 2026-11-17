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
  // TODO 5: añade el producto al carrito llamando a una herramienta del servidor.
  //   const resultado = await app.callServerTool({
  //     name: 'anadir_al_carrito',
  //     arguments: { id: producto.id, cantidad: 1 },
  //   })
  //   - Pinta el carrito con pintarCarrito(resultado.structuredContent)
  //   - Desactiva el botón mientras dura la llamada y muestra los errores en $estado
  //
  // TODO 6 (extra): cuéntale al modelo lo que ha hecho el usuario.
  //   await app.updateModelContext({ content: [{ type: 'text', text: '…' }] })
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
    } catch (error) {
        $estado.textContent = `Error: ${error.message}`;
    } finally {
        $boton.disabled = false;
    }
}

// TODO 4: recibe el resultado de la herramienta que ha abierto esta vista.
//   app.addEventListener('toolresult', (resultado) => { … })
//   - Los datos están en resultado.structuredContent: { productos, carrito }
//   - Usa pintarProductos(productos) y pintarCarrito(carrito)

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
