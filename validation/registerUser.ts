import z from "zod";

export const passwordValidation = z.string().refine((value) => {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/;
        return regex.test(value);
    }, {
        message: 'Нууц үг нь том үсэг, жижиг үсэг, тоо агуулсан байх ёстой'
    });

export const registerUserSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2, "Name must be at least 2 characters"),
    password: z.string().refine((value) => {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{6,}$/;
        return regex.test(value);
    }, {
        message: 'Нууц үг нь том үсэг, жижиг үсэг, тоо агуулсан байх ёстой'
    }),
    passwordConfirm: z.string()
}).superRefine((data, ctx) => {
    if(data.password !== data.passwordConfirm){
        ctx.addIssue({
            message: "Нууц үг таарахгүй байна",
            path: ["passwordConfirm"],
            code: "custom",
        });
    }
});