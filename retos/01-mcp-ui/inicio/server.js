import { createServer } from 'node:http';
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import {
  NodeStreamableHTTPServerTransport,
  localhostHostValidation,
  localhostOriginValidation,
} from '@modelcontextprotocol/node';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { crearVista } from './lib/vista.js';
import { categorias } from './productos.js';
import { añadirAlCarrito, buscarProductos, verCarrito } from './tienda.js';
import { servirProbador } from '../../../probador/servir.js';

// Dirección de la vista. El esquema ui:// indica que es una interfaz de MCP Apps
const VISTA_CATALOGO = 'ui://tienda/catalogo.html';

export function crearServidor() {
    const server = new McpServer({name: 'tienda', version: '1.0.0'});

    // Esta herramienta ya funciona, pero solo devuelve texto.
    registerAppTool(
        server,
        'buscar_productos',
        {
            title: 'Buscar productos',
            description: 'Busca productos en el catálogo de la tienda.',
            inputSchema: z.object({
                texto: z.string().optional().describe('Palabras que buscar en el nombre o la descripción'),
                categoria: z.enum(categorias).optional().describe('Categoría del producto'),
                precioMaximo: z.number().positive().optional().describe('Precio máximo en euros'),
            }),
            _meta: {ui: {resourceUri: VISTA_CATALOGO}},
        },
        async (filtros) => {
            const productos = buscarProductos(filtros);

            return {
                content: [
                    {
                        type: 'text',
                        text: productos.length
                            ? productos.map((p) => `- ${p.nombre} (${p.id}): ${p.precio} €, ★ ${p.valoracion}`).join('\n')
                            : 'No hay productos que coincidan con la búsqueda.',
                    },
                ],
                structuredContent: {productos, carrito: verCarrito()},
            };
        },
    );

    registerAppResource(
        server,
        'Catálogo de la tienda',
        VISTA_CATALOGO,
        {description: 'Cuadrícula de productos con botón para añadir al carrito'},
        async () => ({
            contents: [
                {
                    uri: VISTA_CATALOGO,
                    mimeType: RESOURCE_MIME_TYPE,
                    text: await crearVista(),
                },
            ],
        }),
    );

    server.registerTool(
        'anadir_al_carrito',
        {
            title: 'Añadir al carrito',
            description: 'Añade un producto al carrito por su id.',
            inputSchema: z.object({
                id: z.string().describe('Id del producto, por ejemplo "auriculares-anc"'),
                cantidad: z.number().int().positive().default(1).describe('Unidades que añadir'),
            }),
        },
        async ({id, cantidad}) => {
            try {
                const carrito = añadirAlCarrito(id, cantidad);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Añadido. El carrito tiene ${carrito.unidades} unidades: ${carrito.total} €`
                        },
                    ],
                    structuredContent: carrito,
                };
            } catch (error) {
                return {
                    isError: true,
                    content: [{type: 'text', text: error.message}],
                };
            }
        },
    );

    server.registerTool(
    'ver_carrito',
    {
      title: 'Ver carrito',
      description: 'Devuelve los productos del carrito y el importe total.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      const carrito = verCarrito();
      return {
        content: [
          {
            type: 'text',
            text: carrito.lineas.length
              ? `${carrito.lineas.map((l) => `- ${l.cantidad} × ${l.nombre}: ${l.subtotal} €`).join('\n')}\nTotal: ${carrito.total} €`
              : 'El carrito está vacío.',
          },
        ],
        structuredContent: carrito,
      };
    },
  );

  return server;
}

// Arranca solo si ejecutas este archivo: la pestaña «Ver solución» importa el de ../solucion sin arrancarlo
if (import.meta.main && process.argv.includes('--stdio')) {
  // Para clientes que arrancan el servidor como proceso (Claude Desktop, por ejemplo)
  await crearServidor().connect(new StdioServerTransport());
} else if (import.meta.main) {
  // Servidor HTTP en http://localhost:3001/mcp
  const PUERTO = Number(process.env.PORT ?? 3001);
  const hostValido = localhostHostValidation();
  const origenValido = localhostOriginValidation();

  createServer(async (req, res) => {
    if (!hostValido(req, res) || !origenValido(req, res)) return;

    const { pathname } = new URL(req.url, 'http://localhost');

    // Fuera de /mcp, una web para probar el servidor desde el navegador
    if (pathname !== '/mcp' && pathname !== '/solucion/mcp') {
      await servirProbador(pathname, res);
      return;
    }

    // Sin sesiones: un servidor y un transporte por petición
    const transporte = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    // /solucion/mcp es el servidor de la carpeta solucion: lo usa la pestaña «Ver solución» del probador
    const servidor = pathname === '/mcp' ? crearServidor() : (await import('../solucion/server.js')).crearServidor();
    await servidor.connect(transporte);
    await transporte.handleRequest(req, res);
  }).listen(PUERTO, '127.0.0.1', () => {
    console.log(`Servidor MCP de la tienda en http://localhost:${PUERTO}/mcp`);
    console.log(`Probador en http://localhost:${PUERTO} (y la solución en http://localhost:${PUERTO}/solucion/)`);
  });
}
