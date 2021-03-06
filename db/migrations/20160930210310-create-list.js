'use strict';
module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('lists', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      kk: {type: Sequelize.STRING(64)},
      value: {type: Sequelize.STRING(256)},
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    }).then(function () {
      queryInterface.addIndex('lists', ['kk']);
      queryInterface.addIndex(
          'lists',
          ['kk', 'value'],
          {
            name: 'KeyValue',
            type: 'UNIQUE'
          }
      )
    });
  },
  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('lists');
  }
};
