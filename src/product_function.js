// Lambda function for managing products in Node.js without TypeScript
// Using best practices and JWT authentication with Amazon Cognito

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
        encrypt: true, // Use encryption for data transmission
        trustServerCertificate: true // Set to true for local development (avoid in production)
    }
};

// URL for Cognito's JSON Web Key Set (JWKS), used to verify the token signature
const COGNITO_JWKS_URI = `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;

// Helper function to verify JWT token
async function verifyToken(token) {
    try {
        // Verify the token using Cognito's JWKS URI and RS256 algorithm
        const decoded = verify(token, COGNITO_JWKS_URI, { algorithms: ['RS256'] });
        return decoded;
    } catch (err) {
        // If verification fails, throw unauthorized error
        throw new Error('Unauthorized');
    }
}

// Handler to get the list of products
exports.getProducts = async () => {
    try {
        // Connect to SQL Server
        await sql.connect(SQL_SERVER_CONFIG);
        // Query to get all products from the ProductsTable
        const result = await sql.query`SELECT * FROM dbo.ProductsTable`;
        return {
            statusCode: 200,
            body: JSON.stringify(result.recordset)
        };
    } catch (error) {
        // Handle database connection or query errors
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Handler to add a new product
exports.addProduct = async (event) => {
    // Retrieve the authorization token from headers
    const token = event.headers.Authorization || event.headers.authorization;
    if (!token) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Authorization token missing' })
        };
    }

    try {
        // Verify the token
        await verifyToken(token.replace('Bearer ', ''));

        // Parse product details from request body
        const { name, description, price, quantity } = JSON.parse(event.body);

        // Check if all required fields are provided
        if (!name || !description || !price || quantity == null) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields' })
            };
        }

        // Connect to SQL Server and insert new product into ProductsTable
        await sql.connect(SQL_SERVER_CONFIG);
        await sql.query`
            INSERT INTO dbo.ProductsTable (name, description, price, quantity, createdAt)
            VALUES (${name}, ${description}, ${price}, ${quantity}, GETDATE())
        `;
        return {
            statusCode: 201,
            body: JSON.stringify({ message: 'Product added successfully' })
        };
    } catch (error) {
        // Handle database connection or query errors
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Handler to get a specific product by ID
exports.getProductById = async (event) => {
    // Retrieve the authorization token from headers
    const token = event.headers.Authorization || event.headers.authorization;
    if (!token) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Authorization token missing' })
        };
    }

    try {
        // Verify the token
        await verifyToken(token.replace('Bearer ', ''));

        // Extract productId from the path parameters
        const { productId } = event.pathParameters;

        // Connect to SQL Server and get the product details
        await sql.connect(SQL_SERVER_CONFIG);
        const result = await sql.query`SELECT * FROM dbo.ProductsTable WHERE productId = ${productId}`;
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
        // Handle database connection or query errors
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Handler to update a product by ID
exports.updateProduct = async (event) => {
    // Retrieve the authorization token from headers
    const token = event.headers.Authorization || event.headers.authorization;
    if (!token) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Authorization token missing' })
        };
    }

    try {
        // Verify the token
        await verifyToken(token.replace('Bearer ', ''));

        // Extract productId from the path parameters and updated fields from the request body
        const { productId } = event.pathParameters;
        const { name, description, price, quantity } = JSON.parse(event.body);

        // If no fields are provided to update, return an error
        if (!name && !description && !price && quantity == null) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No fields to update' })
            };
        }

        // Connect to SQL Server and update the product details
        await sql.connect(SQL_SERVER_CONFIG);
        await sql.query`
            UPDATE dbo.ProductsTable
            SET 
                name = ISNULL(${name}, name),
                description = ISNULL(${description}, description),
                price = ISNULL(${price}, price),
                quantity = ISNULL(${quantity}, quantity)
            WHERE productId = ${productId}
        `;
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Product updated successfully' })
        };
    } catch (error) {
        // Handle database connection or query errors
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Handler to delete a product by ID
exports.deleteProduct = async (event) => {
    // Retrieve the authorization token from headers
    const token = event.headers.Authorization || event.headers.authorization;
    if (!token) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: 'Authorization token missing' })
        };
    }

    try {
        // Verify the token
        await verifyToken(token.replace('Bearer ', ''));

        // Extract productId from the path parameters
        const { productId } = event.pathParameters;

        // Connect to SQL Server and delete the product from ProductsTable
        await sql.connect(SQL_SERVER_CONFIG);
        await sql.query`DELETE FROM dbo.ProductsTable WHERE productId = ${productId}`;
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Product deleted successfully' })
        };
    } catch (error) {
        // Handle database connection or query errors
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
