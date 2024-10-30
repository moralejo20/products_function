// Lambda function for managing products in Node.js to be deploy in lambda
// Using best practices, JWT authentication with Amazon Cognito, and Stored Procedures

const sql = require('mssql');
const { verify } = require('jsonwebtoken');
const readline = require('readline');
require('dotenv').config();

// Environment variables to be set in Lambda
const SQL_SERVER_CONFIG = {
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    options: {
        encrypt: true, // Use encryption
        trustServerCertificate: true // Set to true for local development
    }
};

const COGNITO_JWKS_URI = `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;

// Helper function to verify JWT token
async function verifyToken(token) {
    try {
        const decoded = verify(token, COGNITO_JWKS_URI, { algorithms: ['RS256'] });
        return decoded;
    } catch (err) {
        throw new Error('Unauthorized');
    }
}

// Handler to get the list of products
exports.getProducts = async () => {
    try {
        await sql.connect(SQL_SERVER_CONFIG);
        const result = await sql.query`EXEC GetAllProducts`;
        return {
            statusCode: 200,
            body: JSON.stringify(result.recordset)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Handler to add a new product
exports.addProduct = async (event) => {
    const token = event.headers.Authorization || event.headers.authorization;
    if (!token) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Authorization token missing' })
        };
    }

    try {
        await verifyToken(token.replace('Bearer ', ''));

        const { product_id, product_name, description, price, stock_quantity, category, image_url } = JSON.parse(event.body);

        if (!product_id || !product_name || !description || !price || stock_quantity == null || !category || !image_url) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        await sql.connect(SQL_SERVER_CONFIG);
        await sql.query`
            EXEC InsertProduct @product_id = ${product_id}, @product_name = ${product_name}, @description = ${description}, @price = ${price}, @stock_quantity = ${stock_quantity}, @category = ${category}, @image_url = ${image_url}
        `;
        return {
            statusCode: 201,
            body: JSON.stringify({ message: 'Product added successfully' })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Handler to get a specific product by ID
exports.getProductById = async (event) => {
    const token = event.headers.Authorization || event.headers.authorization;
    if (!token) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Authorization token missing' })
        };
    }

    try {
        await verifyToken(token.replace('Bearer ', ''));

        const { product_id } = event.pathParameters;

        await sql.connect(SQL_SERVER_CONFIG);
        const result = await sql.query`EXEC GetProductById @product_id = ${product_id}`;
        if (result.recordset.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Product not found' })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(result.recordset[0])
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Handler to update a product by ID
exports.updateProduct = async (event) => {
    const token = event.headers.Authorization || event.headers.authorization;
    if (!token) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Authorization token missing' })
        };
    }

    try {
        await verifyToken(token.replace('Bearer ', ''));

        const { product_id } = event.pathParameters;
        const { product_name, description, price, stock_quantity, category, image_url } = JSON.parse(event.body);

        if (!product_name && !description && !price && stock_quantity == null && !category && !image_url) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No fields to update' })
            };
        }

        await sql.connect(SQL_SERVER_CONFIG);
        await sql.query`
            EXEC UpdateProduct @product_id = ${product_id}, @product_name = ${product_name}, @description = ${description}, @price = ${price}, @stock_quantity = ${stock_quantity}, @category = ${category}, @image_url = ${image_url}
        `;
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Product updated successfully' })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Handler to delete a product by ID
exports.deleteProduct = async (event) => {
    const token = event.headers.Authorization || event.headers.authorization;
    if (!token) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Authorization token missing' })
        };
    }

    try {
        await verifyToken(token.replace('Bearer ', ''));

        const { product_id } = event.pathParameters;

        await sql.connect(SQL_SERVER_CONFIG);
        await sql.query`EXEC DeleteProduct @product_id = ${product_id}`;
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Product deleted successfully' })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Local testing menu (Use this menu to test the connection with the database)
/*if (require.main === module) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const menu = () => {
        console.log('\n--- Product Management Menu ---');
        console.log('1. Get All Products');
        console.log('2. View Environment Variables');
        console.log('3. Exit');
        rl.question('Choose an option: ', async (option) => {
            switch (option) {
                case '1':
                    try {
                        const products = await exports.getProducts();
                        console.log('\nProducts List:');
                        console.table(products);
                    } catch (error) {
                        console.error('Error fetching products:', error.message);
                    }
                    menu();
                    break;

                case '2':
                    rl.close();
                    process.exit(0);
                    break;
                default:
                    console.log('Invalid option. Please try again.');
                    menu();
                    break;
            }
        });
    };

    menu();
}*/
