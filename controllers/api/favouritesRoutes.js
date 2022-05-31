const router = require('express').Router();
const { Favourites } = require('../../models');

//Add new favourite method
router.post('/', async (req, res) => {
    try {
      
      const data = await Favourites.create({
        rating:req.body.rating,
        user_id: 1,
        file_id:req.body.file_id,
      
      });
  
      res.status(200).json(data);
    } catch (err) {
      res.status(400).json(err);
    }
  });
 
//delete download method
router.delete("/:id", async (req, res) => {
  try {
    const Data = await Favourites.destroy({where: {
      id: req.params.id,
    }});

    res.status(200).json(Data);
  } catch (err) {
    res.status(400).json(err);
  }
});

  module.exports = router;
