const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'HydroPulse Boundary API',
      version: '1.0.0',
      description: 'Backend API cho quản lý hồ chứa, cột mốc, nhiệm vụ và báo cáo hiện trường'
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Local'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

module.exports = swaggerJsdoc(options);
