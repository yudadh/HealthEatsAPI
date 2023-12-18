import * as tf from "@tensorflow/tfjs-node";
import { prisma } from "../application/database.js";

const getFoods = async (req, res, next) => {
    const page = parseInt(req.query.page) || 0
    const limit = parseInt(req.query.limit) || 10
    const search = req.query.search || ""
    const offset = limit * page
    const totalRows = await prisma.foods.count({
        where: {
            food_name: {
                contains: search,
            },
        },
    });

    const totalPage = Math.ceil(totalRows / limit);
    const result = await prisma.foods.findMany({
        where: {
            food_name: {
                contains: search,
            },
        },
        orderBy: {
            id_food: "desc",
        },
        skip: offset,
        take: limit,
    });
    res.status(200).json({
        result,
        page: page,
        limit: limit,
        totalRows: totalRows,
        totalPage: totalPage,
    });

}

const getRandomFood = async (req, res, next) => {
    try {
        const foods = await prisma.foods.findMany({
            where: {
                food_name: {
                    not: ""
                }
            },
            orderBy: {
                id_food: "asc"
            }
        });

        for (let i = foods.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [foods[i], foods[j]] = [foods[j], foods[i]]
        }

        const randomFood = foods.slice(0, 6)

        res.status(200).json({
            result: randomFood
        })
    } catch (error) {
        res.status(404).json({
            msg: "No Foods Can Display"
        });
    }
}

const getFoodById = async (req, res, next) => {
    try {
        const foodId = parseInt(req.params.foodId);

        const checkFoodId = await prisma.foods.count({
            where: {
                id_food: foodId
            }
        });
        if (checkFoodId !== 1) return res.status(404).json({
            msg: "Food Id is Not Found!"
        })

        const food = await prisma.foods.findUnique({
            where: {
                id_food: foodId
            }
        });


        res.status(200).json({
            result: food
        })
    } catch (error) {
        res.status(404).json({
            msg: "Food Id is Not Found!"
        })
    }
}

const predictionAndRecommendations = async (req, res) => {
    const jawaban = req.body.input_data;

    async function loadModel() {
        try {
            const model = await tf.loadLayersModel("file://D:/bangkit/capstone/backend/src/models/model.json");
            return model;
        } catch (err) {
            console.error('Error loading model', err);
            throw err;  // Melempar kesalahan agar dapat ditangani di luar fungsi ini
        }
    }

    try {
        const model = await loadModel();
        const input = tf.tensor2d([jawaban]);

        const output = model.predict(input);
        const predictionIndex = output.argMax(-1).dataSync()[0];
        const maxVal = output.max().dataSync()[0] * 100;

        //   output.print();
        const penyakit = ['Tidak', 'Stroke', 'Hepatitis'];
        const prediksi = penyakit[predictionIndex];

        const disease = await prisma.diseases.findUnique({
            where: {
                id_disease: predictionIndex
            },
            select: {
                description: true
            }
        })

        const result = await prisma.details_disease.findMany({
            where: {
              id_disease: predictionIndex
            },
            select: {
              id_details: true,
              id_disease: true,
              foods: {
                select: {
                  food_name: true,
                  image: true
                }
              },
            }
          });
        
        //   console.log(result.map((item) => item.foods.food_name))
        //   console.log(`Prediksi model: ${prediksi}`);
        //   console.log(`Persentase: ${maxVal.toFixed(2)}%`);
        res.status(200).json({
            result: {
                message: "Sukses Melakukan Prediksi",
                penyakit: prediksi,
                persentase: `${maxVal.toFixed(2)}%`,
                description: disease.description,
                recommendations: result
            }
        });
    } catch (err) {
        console.error('Error during prediction', err);
        res.status(500).json({ error: 'An error occurred during prediction' });
    }
}

export default {
    getFoods,
    getRandomFood,
    getFoodById,
    predictionAndRecommendations
}